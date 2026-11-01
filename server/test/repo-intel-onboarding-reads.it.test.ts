/**
 * L05 Onboarding Tour — the repo-intel facade reads the tour depends on, against
 * a real Postgres (plan step 28).
 *
 * Index rows are inserted directly into `file_rank`, `file_edges`, `file_facts`
 * and `repo_index_state` (a test may write index tables; INV-2 binds `src/`
 * only). The AC-87 case runs the real indexer (full, then incremental) over a
 * temp-dir clone, with a scripted git head/diff and a tiny depgraph stub.
 *
 * Expected values come from AC-13, AC-20, AC-23, AC-35, AC-36, AC-46, AC-47 and
 * AC-87 (D-14, D-23, D-25).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient, MockSecretsProvider } from '../src/adapters/mocks.js';
import { INDEXER_VERSION } from '../src/modules/repo-intel/constants.js';
import type { RepoIntel } from '../src/modules/repo-intel/types.js';
import { RepoIntelRepository } from '../src/modules/repo-intel/repository.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;
if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[repo-intel-onboarding-reads] Docker not available — skipping integration tests.');
}

/** A git mock whose head and changed-file list a test moves between passes. */
class ScriptedGit extends MockGitClient {
  headSha = 'sha-1';
  changed: string[] = [];
  override async currentHead(): Promise<string> {
    return this.headSha;
  }
  override async diffNameOnly(): Promise<string[]> {
    return this.changed;
  }
}

d('repo-intel facade reads for the onboarding tour (Testcontainers pg)', () => {
  let pg: PgFixture;
  let app: FastifyInstance;
  let ri: RepoIntel;
  let workspaceId: string;
  let repoId: string;
  const git = new ScriptedGit();

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
    const config = loadConfig({ ...process.env, NODE_ENV: 'test', REPO_INTEL_ENABLED: 'true' } as NodeJS.ProcessEnv);
    app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git,
        github: new MockGitHubClient(),
        secrets: new MockSecretsProvider({}),
        depgraph: { buildEdges: async () => [] },
      },
    });
    ri = app.container.repoIntel;
  });

  afterAll(async () => {
    await app?.close();
    await pg?.stop();
  });

  beforeEach(async () => {
    const [r] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: `r-${Math.random().toString(36).slice(2)}`, fullName: `acme/r-${Math.random().toString(36).slice(2)}` })
      .returning();
    repoId = r!.id;
  });

  const rank = (rows: Array<[path: string, rank: number, percentile?: number]>) =>
    pg.handle.db.insert(t.fileRank).values(
      rows.map(([filePath, r, percentile]) => ({ repoId, filePath, pagerank: r, hotness: 0, rank: r, percentile: percentile ?? 50 })),
    );
  const edges = (rows: Array<[from: string, to: string]>) =>
    pg.handle.db.insert(t.fileEdges).values(rows.map(([fromFile, toFile]) => ({ repoId, fromFile, toFile })));

  it('AC-46, AC-23 — equal-rank files come back in path order, the same on every call', async () => {
    await rank([
      ['src/c.ts', 0.5],
      ['src/top.ts', 0.9],
      ['src/a.ts', 0.5],
      ['src/b.ts', 0.5],
    ]);
    const expected = ['src/top.ts', 'src/a.ts', 'src/b.ts', 'src/c.ts'];
    for (let i = 0; i < 3; i += 1) {
      expect(await ri.getTopFilesByRank(repoId, 10)).toEqual(expected);
      expect((await ri.getIndexedFiles(repoId)).map((f) => f.path)).toEqual(expected);
    }
  });

  it('AC-47 — tests, migrations, fixtures, declaration and config files never make the reading path', async () => {
    await rank([
      ['test/a.ts', 0.99],
      ['migrations/0001.ts', 0.98],
      ['fixtures/x.ts', 0.97],
      ['src/a.test.ts', 0.96],
      ['src/b.d.ts', 0.95],
      ['vitest.config.ts', 0.94],
      ['src/core.ts', 0.1],
    ]);
    expect(await ri.getTopFilesByRank(repoId, 8)).toEqual(['src/core.ts']);
  });

  it('AC-36, D-14 — importers counts distinct importing files; percentile is as stored', async () => {
    await rank([
      ['src/t.ts', 0.9, 97],
      ['src/u.ts', 0.8, 60],
      ['src/x.ts', 0.2, 10],
      ['src/y.ts', 0.1, 5],
    ]);
    await edges([
      ['src/x.ts', 'src/t.ts'],
      ['src/y.ts', 'src/t.ts'],
      ['src/x.ts', 'src/u.ts'],
    ]);
    const byPath = new Map((await ri.getIndexedFiles(repoId)).map((f) => [f.path, f]));
    expect(byPath.get('src/t.ts')).toMatchObject({ importers: 2, percentile: 97 });
    expect(byPath.get('src/u.ts')).toMatchObject({ importers: 1, percentile: 60 });
    expect(byPath.get('src/x.ts')).toMatchObject({ importers: 0, percentile: 10 });
  });

  it('AC-35, AC-23 — a rank tie in the adjacency picks the path-ascending target, on every call', async () => {
    await rank([
      ['src/root.ts', 0.9],
      ['src/zeta.ts', 0.3],
      ['src/alpha.ts', 0.3],
    ]);
    await edges([
      ['src/root.ts', 'src/zeta.ts'],
      ['src/root.ts', 'src/alpha.ts'],
    ]);
    const first = await ri.getCriticalPaths(repoId);
    expect(first[0]!.slice(0, 2)).toEqual(['src/root.ts', 'src/alpha.ts']);
    for (let i = 0; i < 3; i += 1) expect(await ri.getCriticalPaths(repoId)).toEqual(first);
  });

  it('AC-20 — getEndpoints returns every (file, endpoint) from file_facts, file then endpoint ordered', async () => {
    await pg.handle.db.insert(t.fileFacts).values([
      { repoId, filePath: 'src/b.ts', endpoints: ['POST /x', 'GET /a'], crons: [] },
      { repoId, filePath: 'src/a.ts', endpoints: ['GET /z'], crons: [] },
      { repoId, filePath: 'src/c.ts', endpoints: [], crons: [] },
    ]);
    expect(await ri.getEndpoints(repoId)).toEqual([
      { file: 'src/a.ts', endpoint: 'GET /z' },
      { file: 'src/b.ts', endpoint: 'GET /a' },
      { file: 'src/b.ts', endpoint: 'POST /x' },
    ]);
  });

  it('AC-13, D-23 — getIndexState().coverage reflects the walk stats', async () => {
    const put = (stats: Record<string, unknown>) =>
      pg.handle.db
        .insert(t.repoIndexState)
        .values({ repoId, lastIndexedSha: 's', indexerVersion: INDEXER_VERSION, status: 'partial', filesIndexed: 5000, stats })
        .onConflictDoUpdate({ target: t.repoIndexState.repoId, set: { stats } });

    await put({ totalCandidates: 12450, bounded: 7450, softBudgetReached: false });
    expect((await ri.getIndexState(repoId)).coverage).toEqual({ totalSourceFiles: 12450, bounded: 7450, softBudgetReached: false });

    await put({ totalCandidates: 900, bounded: 0, softBudgetReached: true });
    expect((await ri.getIndexState(repoId)).coverage).toEqual({ totalSourceFiles: 900, bounded: 0, softBudgetReached: true });

    await put({});
    expect((await ri.getIndexState(repoId)).coverage).toEqual({ totalSourceFiles: null, bounded: 0, softBudgetReached: false });
  });

  it('AC-87 — N and M stay equal to the files on disk after a full index and incremental refreshes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'onb-ac87-'));
    try {
      await mkdir(join(dir, 'src'), { recursive: true });
      const write = (p: string, body: string) => writeFile(join(dir, p), body, 'utf8');
      for (let i = 1; i <= 5; i += 1) await write(`src/f${i}.ts`, `export const f${i} = ${i};\n`);
      await pg.handle.db.update(t.repos).set({ clonePath: dir }).where(eq(t.repos.id, repoId));

      const check = async (expected: number) => {
        const files = await ri.getIndexedFiles(repoId);
        const [row] = await pg.handle.db.select().from(t.repoIndexState).where(eq(t.repoIndexState.repoId, repoId));
        const state = await ri.getIndexState(repoId);
        return { indexed: files.length, filesIndexed: row!.filesIndexed, total: state.coverage?.totalSourceFiles, expected };
      };

      // 1. full index over 5 files
      git.headSha = 'sha-1';
      await ri.indexRepo(repoId);
      expect(await check(5)).toEqual({ indexed: 5, filesIndexed: 5, total: 5, expected: 5 });

      // 2. add 2 files, edit 1
      await write('src/f6.ts', 'export const f6 = 6;\n');
      await write('src/f7.ts', 'export const f7 = 7;\n');
      await write('src/f1.ts', 'export const f1 = 100;\n');
      git.headSha = 'sha-2';
      git.changed = ['src/f6.ts', 'src/f7.ts', 'src/f1.ts'];
      await ri.refreshIndex(repoId);
      expect(await check(7)).toEqual({ indexed: 7, filesIndexed: 7, total: 7, expected: 7 });

      // 3. remove 1 file, edit another
      await rm(join(dir, 'src/f7.ts'));
      await write('src/f2.ts', 'export const f2 = 200;\n');
      git.headSha = 'sha-3';
      git.changed = ['src/f7.ts', 'src/f2.ts'];
      await ri.refreshIndex(repoId);
      expect(await check(6)).toEqual({ indexed: 6, filesIndexed: 6, total: 6, expected: 6 });

      // 4. unchanged sha keeps all three numbers
      git.changed = [];
      await ri.refreshIndex(repoId);
      expect(await check(6)).toEqual({ indexed: 6, filesIndexed: 6, total: 6, expected: 6 });
    } finally {
      git.headSha = 'sha-1';
      git.changed = [];
      await rm(dir, { recursive: true, force: true });
    }
  });
  // F-39 (D-16 rev. 4): "who imports these files?" — the edges into the given
  // targets, served by the (repo_id, to_file) index; other repos never leak in.
  it('F-39 — getEdgesTo / getImporters return exactly the edges into the given targets, ordered, scoped to the repo', async () => {
    await edges([
      ['test/main.ts', 'source/index.ts'],
      ['source/other.ts', 'source/index.ts'],
      ['test/main.ts', 'source/core.ts'],
      ['source/index.ts', 'source/util.ts'], // a target not asked for
    ]);
    // the same edge in another repo must not appear
    const [other] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: `o-${Math.random().toString(36).slice(2)}`, fullName: `acme/o-${Math.random().toString(36).slice(2)}` })
      .returning();
    await pg.handle.db.insert(t.fileEdges).values({ repoId: other!.id, fromFile: 'test/evil.ts', toFile: 'source/index.ts' });

    const repo = new RepoIntelRepository(pg.handle.db);
    expect(await repo.getEdgesTo(repoId, ['source/index.ts', 'source/core.ts'])).toEqual([
      { fromFile: 'source/other.ts', toFile: 'source/index.ts' },
      { fromFile: 'test/main.ts', toFile: 'source/core.ts' },
      { fromFile: 'test/main.ts', toFile: 'source/index.ts' },
    ]);
    expect(await repo.getEdgesTo(repoId, [])).toEqual([]);

    expect(await ri.getImporters(repoId, ['source/index.ts', 'source/core.ts'])).toEqual([
      { from: 'source/other.ts', to: 'source/index.ts' },
      { from: 'test/main.ts', to: 'source/core.ts' },
      { from: 'test/main.ts', to: 'source/index.ts' },
    ]);
    expect(await ri.getImporters(repoId, ['source/nothing.ts'])).toEqual([]);
    expect(await ri.getImporters(repoId, [])).toEqual([]);
  });
});
