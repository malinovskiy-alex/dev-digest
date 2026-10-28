/**
 * GET /pulls/:id/history — Prior PRs against a real Postgres, with GitHub
 * mocked. Proves the workspace + repo scoping, the merged-only filter, the
 * `pr_files` cache fill and its reuse, and the GitHub-down degradation.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import { MockGitHubClient } from '../src/adapters/mocks.js';
import * as t from '../src/db/schema.js';
import type { GitHubClient } from '@devdigest/shared';
import { PrHistory } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

type Db = PgFixture['handle']['db'];

let repoSeq = 0;
async function insertPr(
  db: Db,
  values: { workspaceId: string; repoId: string; number: number; status: string; updatedAt: string },
  files: string[],
) {
  const [pr] = await db
    .insert(t.pullRequests)
    .values({
      workspaceId: values.workspaceId,
      repoId: values.repoId,
      number: values.number,
      title: `PR ${values.number}`,
      author: `dev${values.number}`,
      branch: `b${values.number}`,
      base: 'main',
      headSha: `sha${values.number}`,
      status: values.status,
      updatedAt: new Date(values.updatedAt),
    })
    .returning();
  if (files.length > 0) {
    await db
      .insert(t.prFiles)
      .values(files.map((path) => ({ prId: pr!.id, path, additions: 1, deletions: 0 })));
  }
  return pr!;
}

/** repo + current PR (a.ts, b.ts) + merged #5 (cached a.ts) + merged #6 (uncached) + open #7 (a.ts). */
async function setupScenario(db: Db, workspaceId: string) {
  const name = `history-${repoSeq++}`;
  const [repo] = await db
    .insert(t.repos)
    .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
    .returning();
  const repoId = repo!.id;
  const current = await insertPr(
    db,
    { workspaceId, repoId, number: 10, status: 'open', updatedAt: '2026-05-01T00:00:00Z' },
    ['a.ts', 'b.ts'],
  );
  const pr5 = await insertPr(
    db,
    { workspaceId, repoId, number: 5, status: 'merged', updatedAt: '2026-03-01T00:00:00Z' },
    ['a.ts'],
  );
  const pr6 = await insertPr(
    db,
    { workspaceId, repoId, number: 6, status: 'merged', updatedAt: '2026-04-01T00:00:00Z' },
    [],
  );
  await insertPr(
    db,
    { workspaceId, repoId, number: 7, status: 'open', updatedAt: '2026-04-15T00:00:00Z' },
    ['a.ts'],
  );
  return { repoId, current, pr5, pr6 };
}

d('GET /pulls/:id/history (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it('lists merged overlapping PRs, fills the pr_files cache once, scopes by workspace', async () => {
    const db = pg.handle.db;
    const { repoId, current, pr6 } = await setupScenario(db, workspaceId);

    // A merged PR on the same repo id but in ANOTHER workspace, touching a.ts.
    const [otherWs] = await db
      .insert(t.workspaces)
      .values({ name: 'other' })
      .returning();
    await insertPr(
      db,
      { workspaceId: otherWs!.id, repoId, number: 99, status: 'merged', updatedAt: '2026-04-20T00:00:00Z' },
      ['a.ts'],
    );

    const gh = new MockGitHubClient({
      pullFiles: { 6: [{ path: 'b.ts', additions: 3, deletions: 1, patch: null }] },
    });
    const app = await buildApp({ config: config(), db, overrides: { github: gh } });

    const res = await app.inject({ method: 'GET', url: `/pulls/${current.id}/history` });
    expect(res.statusCode).toBe(200);
    const body = PrHistory.parse(res.json());
    expect(body.history.map((h) => h.pr_number)).toEqual([6, 5]);
    expect(body.history[0]!.files_overlap).toEqual(['b.ts']);
    expect(body.history[1]!.files_overlap).toEqual(['a.ts']);
    expect(body).toMatchObject({ candidates: 2, unchecked: 0, github_unavailable: false });

    expect(gh.listPullFilesCalls).toEqual([6]);
    const cachedRows = await db.select().from(t.prFiles).where(eq(t.prFiles.prId, pr6.id));
    expect(cachedRows.map((r) => r.path)).toEqual(['b.ts']);

    // Second load is served from pr_files — no new GitHub call.
    const again = await app.inject({ method: 'GET', url: `/pulls/${current.id}/history` });
    expect(again.statusCode).toBe(200);
    expect(PrHistory.parse(again.json()).history.map((h) => h.pr_number)).toEqual([6, 5]);
    expect(gh.listPullFilesCalls).toEqual([6]);
    await app.close();
  });

  it('GitHub unavailable → 200 with cached matches and github_unavailable', async () => {
    const db = pg.handle.db;
    const { current } = await setupScenario(db, workspaceId);
    const broken = new MockGitHubClient();
    (broken as unknown as GitHubClient).listPullFiles = async () => {
      throw new Error('Bad credentials');
    };
    const app = await buildApp({ config: config(), db, overrides: { github: broken } });

    const res = await app.inject({ method: 'GET', url: `/pulls/${current.id}/history` });
    expect(res.statusCode).toBe(200);
    const body = PrHistory.parse(res.json());
    expect(body.history.map((h) => h.pr_number)).toEqual([5]);
    expect(body).toMatchObject({ candidates: 2, unchecked: 1, github_unavailable: true });
    await app.close();
  });
});
