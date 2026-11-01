/**
 * L05 Onboarding Tour — `OnboardingRepository.listOpenPulls` against a real
 * Postgres. Since F-61 this query is the ONE place the open-PR rule lives
 * (D-17): not merged/closed, `updated_at` desc NULLS LAST, then number desc,
 * at most `limit`, scoped to the workspace and the repo. `openPrCandidates`
 * only maps its rows, so the filter, order and determinism (AC-23) are pinned
 * here.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { OnboardingRepository } from '../src/modules/onboarding/repository.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;
if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[onboarding-pulls] Docker not available — skipping integration tests.');
}

d('OnboardingRepository.listOpenPulls (Testcontainers pg)', () => {
  let pg: PgFixture;
  let store: OnboardingRepository;
  let workspaceId: string;
  let otherWorkspaceId: string;
  let repoId: string;
  let otherRepoId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
    const [other] = await pg.handle.db.insert(t.workspaces).values({ name: 'other-ws' }).returning();
    otherWorkspaceId = other!.id;
    store = new OnboardingRepository(pg.handle.db);
  });

  afterAll(async () => {
    await pg?.stop();
  });

  const newRepo = async (ws: string) => {
    const suffix = Math.random().toString(36).slice(2);
    const [r] = await pg.handle.db.insert(t.repos).values({ workspaceId: ws, owner: 'acme', name: `r-${suffix}`, fullName: `acme/r-${suffix}` }).returning();
    return r!.id;
  };

  beforeEach(async () => {
    repoId = await newRepo(workspaceId);
    otherRepoId = await newRepo(workspaceId);
  });

  const pull = (ws: string, repo: string, number: number, status: string, updatedAt: string | null) =>
    pg.handle.db.insert(t.pullRequests).values({
      workspaceId: ws,
      repoId: repo,
      number,
      title: `PR ${number}`,
      author: 'dev',
      branch: `b${number}`,
      base: 'main',
      headSha: 'h',
      status,
      updatedAt: updatedAt === null ? null : new Date(updatedAt),
    });

  it('F-61, D-17 — merged and closed are dropped; every other status is open', async () => {
    await pull(workspaceId, repoId, 1, 'open', '2026-01-01');
    await pull(workspaceId, repoId, 2, 'merged', '2026-01-03');
    await pull(workspaceId, repoId, 3, 'closed', '2026-01-04');
    await pull(workspaceId, repoId, 4, 'needs_review', '2026-01-02');
    expect((await store.listOpenPulls(workspaceId, repoId, 50)).map((p) => p.number)).toEqual([4, 1]);
  });

  it('F-61, D-17, AC-23 — updated_at desc, NULLS LAST, ties by number desc; the same on every call', async () => {
    await pull(workspaceId, repoId, 1, 'open', '2026-01-01');
    await pull(workspaceId, repoId, 2, 'open', null);
    await pull(workspaceId, repoId, 3, 'open', '2026-01-01'); // ties with #1
    await pull(workspaceId, repoId, 4, 'open', '2026-02-01');
    await pull(workspaceId, repoId, 5, 'open', null); // ties with #2
    const expected = [4, 3, 1, 5, 2];
    for (let i = 0; i < 3; i += 1) {
      expect((await store.listOpenPulls(workspaceId, repoId, 50)).map((p) => p.number)).toEqual(expected);
    }
  });

  it('F-61, D-17 — at most `limit` rows, the newest kept', async () => {
    for (let n = 1; n <= 7; n += 1) await pull(workspaceId, repoId, n, 'open', `2026-01-0${n}`);
    expect((await store.listOpenPulls(workspaceId, repoId, 3)).map((p) => p.number)).toEqual([7, 6, 5]);
  });

  it('F-61 — scoped to the repo and the workspace', async () => {
    await pull(workspaceId, repoId, 1, 'open', '2026-01-01');
    await pull(workspaceId, otherRepoId, 2, 'open', '2026-01-02');
    const foreignRepo = await newRepo(otherWorkspaceId);
    await pull(otherWorkspaceId, foreignRepo, 3, 'open', '2026-01-03');
    expect((await store.listOpenPulls(workspaceId, repoId, 50)).map((p) => p.number)).toEqual([1]);
    expect(await store.listOpenPulls(otherWorkspaceId, repoId, 50)).toEqual([]);
  });

  it('F-61 — the row shape openPrCandidates maps', async () => {
    await pull(workspaceId, repoId, 9, 'needs_review', '2026-03-01T10:00:00Z');
    expect(await store.listOpenPulls(workspaceId, repoId, 50)).toEqual([
      { number: 9, title: 'PR 9', author: 'dev', status: 'needs_review', updatedAt: new Date('2026-03-01T10:00:00Z') },
    ]);
  });
});
