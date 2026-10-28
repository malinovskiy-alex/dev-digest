/**
 * GET /pulls/:id/blast — route + response contract against a real Postgres.
 * repo-intel is replaced by a fake facade (ContainerOverrides.repoIntel), so
 * this proves the wiring: workspace-scoped PR lookup, the PR's files reaching
 * the facade, response validation by `BlastRadius`, and the error envelope.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import type { ContainerOverrides } from '../src/platform/container.js';
import type { BlastFacadeResult } from '../src/modules/blast/types.js';
import { BlastRadius } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

const FACADE: BlastFacadeResult = {
  changedSymbols: [
    { file: 'src/ctx.ts', name: 'getContext', kind: 'function' },
    { file: 'src/util.ts', name: 'slug', kind: 'function' },
  ],
  callers: [
    { file: 'src/a/routes.ts', symbol: 'aRoutes', viaSymbol: 'getContext', line: 12, rank: 0.7 },
    { file: 'src/ctx.ts', symbol: 'requireRepo', viaSymbol: 'getContext', line: 40, rank: 0.9 },
    { file: 'src/b/jobs.ts', symbol: 'nightly', viaSymbol: 'slug', line: 3, rank: 0.1 },
  ],
  impactedEndpoints: ['GET /a'],
  factsByFile: {
    'src/a/routes.ts': { endpoints: ['GET /a'], crons: [] },
    'src/b/jobs.ts': { endpoints: [], crons: ['0 3 * * *'] },
  },
  degraded: false,
};

function fakeRepoIntel(state: { next: BlastFacadeResult; seen: string[][] }) {
  return {
    async getBlastRadius(_repoId: string, files: string[]) {
      state.seen.push(files);
      return state.next;
    },
    async getIndexState(repoId: string) {
      return {
        repoId,
        status: 'full' as const,
        filesIndexed: 10,
        filesSkipped: 0,
        durationMs: 5,
        lastIndexedSha: 'idx-sha',
        indexerVersion: 1,
        updatedAt: new Date(),
      };
    },
  } as unknown as NonNullable<ContainerOverrides['repoIntel']>;
}

d('GET /pulls/:id/blast (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let prId: string;
  const state = { next: FACADE, seen: [] as string[][] };
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: 'blast-api', fullName: 'acme/blast-api' })
      .returning();
    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 42,
        title: 'Touch getContext',
        author: 'dev',
        branch: 'feat/x',
        base: 'main',
        headSha: 'head-sha',
        status: 'open',
      })
      .returning();
    prId = pr!.id;
    await pg.handle.db.insert(t.prFiles).values([
      { prId, path: 'src/ctx.ts', additions: 1, deletions: 0 },
      { prId, path: 'src/util.ts', additions: 2, deletions: 1 },
    ]);
    app = await buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: { repoIntel: fakeRepoIntel(state) },
    });
  });
  afterAll(async () => {
    await app?.close();
    await pg?.stop();
  });

  it('200 with a body that passes BlastRadius, grouped from the facade', async () => {
    state.next = FACADE;
    state.seen = [];
    const res = await app.inject({ method: 'GET', url: `/pulls/${prId}/blast` });
    expect(res.statusCode).toBe(200);
    const body = BlastRadius.parse(res.json());

    expect(state.seen).toHaveLength(1);
    expect([...state.seen[0]!].sort()).toEqual(['src/ctx.ts', 'src/util.ts']);

    expect(body.downstream.map((g) => g.symbol)).toEqual(['getContext', 'slug']);
    // the caller inside the declaring file is dropped (P2.5)
    expect(body.downstream[0]!.callers.map((c) => c.file)).toEqual(['src/a/routes.ts']);
    expect(body.downstream[0]!.endpoints_affected).toEqual(['GET /a']);
    expect(body.downstream[1]!.crons_affected).toEqual(['0 3 * * *']);
    expect(body.counts).toEqual({ symbols: 2, callers: 2, endpoints: 1, crons: 1 });
    expect(body).toMatchObject({
      degraded: false,
      reason: null,
      index_status: 'full',
      indexed_sha: 'idx-sha',
    });
  });

  it('a degraded facade result reaches the body (P2.7)', async () => {
    state.next = { ...FACADE, factsByFile: undefined, degraded: true, reason: 'index_failed' };
    const res = await app.inject({ method: 'GET', url: `/pulls/${prId}/blast` });
    expect(res.statusCode).toBe(200);
    const body = BlastRadius.parse(res.json());
    expect(body.degraded).toBe(true);
    expect(body.reason).toBe('index_failed');
  });

  it('unknown PR → 404 envelope; malformed id → 422', async () => {
    const missing = await app.inject({ method: 'GET', url: `/pulls/${randomUUID()}/blast` });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('not_found');

    const bad = await app.inject({ method: 'GET', url: '/pulls/not-a-uuid/blast' });
    expect(bad.statusCode).toBe(422);
    expect(bad.json().error.code).toBe('validation_error');
  });
});
