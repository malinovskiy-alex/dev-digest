/**
 * L08 Agent Performance — both reads against a real Postgres.
 *   GET /agents/performance  and  GET /agents/:id/stats
 * Cases follow specs/L08-agent-performance.decisions.md §C, step 22.
 *
 * Range under test: [2030-01-11, 2030-01-21) UTC; previous window
 * [2030-01-01, 2030-01-11). Far from any real data, all instants explicit.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { count, eq, sql } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { MockAuthProvider, MockGitHubClient, MockLLMProvider } from '../src/adapters/mocks.js';
import * as t from '../src/db/schema.js';
import { AgentPerformanceReport, AgentStatsReport } from '@devdigest/shared';
import type { GitHubClient } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
type Db = PgFixture['handle']['db'];

const FROM = '2030-01-11T00:00:00.000Z';
const TO = '2030-01-21T00:00:00.000Z';
const PREV_FROM = '2030-01-01T00:00:00.000Z';
const Q = `from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`;

type FindingState = 'accepted' | 'dismissed' | 'both' | 'pending';

interface Ctx {
  db: Db;
  workspaceId: string;
  prId: string;
}

async function insertRun(
  c: Ctx,
  v: {
    agentId: string | null;
    ranAt: string;
    status?: string;
    provider?: string | null;
    model?: string | null;
    costUsd?: number | null;
    durationMs?: number | null;
    source?: 'local' | 'ci';
  },
): Promise<string> {
  const [row] = await c.db
    .insert(t.agentRuns)
    .values({
      workspaceId: c.workspaceId,
      agentId: v.agentId,
      prId: c.prId,
      ranAt: new Date(v.ranAt),
      status: v.status ?? 'done',
      provider: v.provider === undefined ? 'openai' : v.provider,
      model: v.model === undefined ? 'gpt-4o' : v.model,
      costUsd: v.costUsd === undefined ? null : v.costUsd,
      durationMs: v.durationMs === undefined ? null : v.durationMs,
      source: v.source ?? 'local',
    })
    .returning({ id: t.agentRuns.id });
  return row!.id;
}

async function addReview(
  c: Ctx,
  runId: string,
  agentId: string | null,
  findings: { state: FindingState; kind?: string }[],
): Promise<void> {
  const [review] = await c.db
    .insert(t.reviews)
    .values({ workspaceId: c.workspaceId, prId: c.prId, agentId, runId, kind: 'review' })
    .returning({ id: t.reviews.id });
  if (findings.length === 0) return;
  const at = new Date('2030-02-01T00:00:00Z');
  await c.db.insert(t.findings).values(
    findings.map((f, i) => ({
      reviewId: review!.id,
      file: 'a.ts',
      startLine: i + 1,
      endLine: i + 1,
      severity: 'warning',
      category: 'bug',
      title: `f${i}`,
      rationale: 'r',
      confidence: 0.9,
      kind: f.kind ?? 'finding',
      acceptedAt: f.state === 'accepted' || f.state === 'both' ? at : null,
      dismissedAt: f.state === 'dismissed' || f.state === 'both' ? at : null,
    })),
  );
}

async function makeWorkspace(db: Db, name: string): Promise<Ctx> {
  const [ws] = await db.insert(t.workspaces).values({ name }).returning();
  const [repo] = await db
    .insert(t.repos)
    .values({ workspaceId: ws!.id, owner: 'acme', name, fullName: `acme/${name}` })
    .returning();
  const [pr] = await db
    .insert(t.pullRequests)
    .values({
      workspaceId: ws!.id,
      repoId: repo!.id,
      number: 1,
      title: 'PR',
      author: 'dev',
      branch: 'b',
      base: 'main',
      headSha: 'sha',
    })
    .returning();
  return { db, workspaceId: ws!.id, prId: pr!.id };
}

async function insertAgent(c: Ctx, name: string, enabled = true): Promise<string> {
  const [a] = await c.db
    .insert(t.agents)
    .values({ workspaceId: c.workspaceId, name, provider: 'openai', model: 'gpt-4o', systemPrompt: 'p', enabled })
    .returning({ id: t.agents.id });
  return a!.id;
}

/** Counts every method call on a GitHub client. */
function countingGitHub(): { client: GitHubClient; calls: () => number } {
  let n = 0;
  const inner = new MockGitHubClient();
  const client = new Proxy(inner, {
    get(target, prop, receiver) {
      const v = Reflect.get(target, prop, receiver);
      if (typeof v !== 'function') return v;
      return (...args: unknown[]) => {
        n++;
        return (v as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  }) as unknown as GitHubClient;
  return { client, calls: () => n };
}

d('agent performance reads (Testcontainers pg)', () => {
  let pg: PgFixture;
  let app: FastifyInstance;
  let W: Ctx;
  let F: Ctx;
  let ids: { A: string; B: string; C: string; D: string; FA: string; r1: string };
  const llm = new MockLLMProvider('openai');
  const llm2 = new MockLLMProvider('anthropic');
  const gh = countingGitHub();

  beforeAll(async () => {
    pg = await startPg();
    const db = pg.handle.db;
    W = await makeWorkspace(db, 'perf-w');
    F = await makeWorkspace(db, 'perf-f');

    const A = await insertAgent(W, 'Alpha');
    const B = await insertAgent(W, 'Beta', false);
    const C = await insertAgent(W, 'Gamma');
    const D = await insertAgent(W, 'Doomed');
    const FA = await insertAgent(F, 'Foreign');

    // ---- A, current window ----
    const r1 = await insertRun(W, { agentId: A, ranAt: FROM, costUsd: 0.1, durationMs: 1000 });
    await addReview(W, r1, A, [
      { state: 'accepted' },
      { state: 'accepted', kind: 'secret_leak' },
      { state: 'both' }, // accepted wins
      { state: 'dismissed' },
      { state: 'pending', kind: 'phantom' },
    ]);
    const r2 = await insertRun(W, { agentId: A, ranAt: '2030-01-15T23:30:00Z', costUsd: 0.2, durationMs: 3000, source: 'ci' });
    await addReview(W, r2, A, [
      { state: 'dismissed', kind: 'lethal_trifecta' },
      { state: 'pending', kind: 'hook' },
    ]);
    await insertRun(W, { agentId: A, ranAt: '2030-01-16T01:00:00Z', provider: 'anthropic', model: 'claude' });
    await insertRun(W, { agentId: A, ranAt: '2030-01-18T12:00:00Z', model: null, costUsd: 0.05, durationMs: 2000 });
    // not counted: failed (with an accepted finding), running, cancelled, at exactly `to`
    const failed = await insertRun(W, { agentId: A, ranAt: '2030-01-12T00:00:00Z', status: 'failed', costUsd: 9 });
    await addReview(W, failed, A, [{ state: 'accepted' }]);
    await insertRun(W, { agentId: A, ranAt: '2030-01-12T00:00:00Z', status: 'running', costUsd: 9 });
    await insertRun(W, { agentId: A, ranAt: '2030-01-13T00:00:00Z', status: 'cancelled', costUsd: 9 });
    await insertRun(W, { agentId: A, ranAt: TO, costUsd: 9 });

    // ---- A, previous window ----
    const p1 = await insertRun(W, { agentId: A, ranAt: PREV_FROM, costUsd: 1 });
    await addReview(W, p1, A, [{ state: 'accepted' }, { state: 'dismissed' }]);
    await insertRun(W, { agentId: A, ranAt: '2029-12-31T23:59:59.999Z', costUsd: 7 }); // in neither

    // ---- B (disabled), all unpriced ----
    await insertRun(W, { agentId: B, ranAt: '2030-01-12T10:00:00Z', provider: 'openrouter', model: 'x' });
    await insertRun(W, { agentId: B, ranAt: '2030-01-13T10:00:00Z', provider: 'openrouter', model: 'x' });

    // ---- D: runs, then the agent is deleted ----
    const d1 = await insertRun(W, { agentId: D, ranAt: '2030-01-14T10:00:00Z', costUsd: 0.4 });
    await addReview(W, d1, D, [{ state: 'accepted' }]);
    await db.delete(t.agents).where(eq(t.agents.id, D));

    // ---- F: same shape, other numbers; plus cross-workspace traps ----
    const f1 = await insertRun(F, { agentId: FA, ranAt: '2030-01-15T00:00:00Z', costUsd: 100, durationMs: 50 });
    await addReview(F, f1, FA, [{ state: 'accepted' }, { state: 'dismissed' }]);
    // an F run pointing at W's agent A, and an F review hanging off W's run r1
    await insertRun(F, { agentId: A, ranAt: '2030-01-15T00:00:00Z', costUsd: 100 });
    await addReview(F, r1, A, [{ state: 'accepted' }, { state: 'dismissed' }, { state: 'pending' }]);

    ids = { A, B, C, D, FA, r1 };

    app = await buildApp({
      config: config(),
      db,
      overrides: {
        auth: new MockAuthProvider(undefined, { id: W.workspaceId, name: 'perf-w' }),
        github: gh.client,
        llm: { openai: llm, anthropic: llm2, openrouter: llm },
      },
    });
  });

  afterAll(async () => {
    await app?.close();
    await pg?.stop();
  });

  async function dashboard(extra = 'tz=UTC'): Promise<AgentPerformanceReport> {
    const res = await app.inject({ method: 'GET', url: `/agents/performance?${Q}&${extra}` });
    expect(res.statusCode, res.body).toBe(200);
    return AgentPerformanceReport.parse(res.json());
  }
  async function stats(id: string): Promise<AgentStatsReport> {
    const res = await app.inject({ method: 'GET', url: `/agents/${id}/stats?${Q}&tz=UTC&bucket=day` });
    expect(res.statusCode, res.body).toBe(200);
    return AgentStatsReport.parse(res.json());
  }

  it('R-01, R-106, D-26: stats deep-equal the dashboard row for A and B', async () => {
    const dash = await dashboard();
    for (const id of [ids.A, ids.B]) {
      const s = await stats(id);
      const row = dash.agents.find((r) => r.agent_id === id)!;
      expect(s.figures).toEqual(row.figures);
      expect(s.comparison).toEqual(row.comparison);
      expect(s.cost_by_model).toEqual(row.cost_by_model);
    }
  });

  it('R-02…R-13: A counts done runs in [from, to), any source, every finding kind', async () => {
    const s = await stats(ids.A);
    const f = s.figures;
    expect(f.runs).toBe(4); // r1 (at from), r2 (ci), r3, r4 — not failed/running/cancelled/at-to
    expect(f.priced_runs).toBe(3);
    expect(f.unpriced_runs).toBe(1);
    expect(f.total_cost_usd).toBeCloseTo(0.35, 12);
    expect(f.avg_cost_usd).toBeCloseTo(0.35 / 3, 12);
    expect(f.avg_duration_ms).toBe(2000);
    expect(f.accepted).toBe(3);
    expect(f.dismissed).toBe(2);
    expect(f.pending).toBe(2);
    expect(f.decided).toBe(5);
    expect(f.accept_rate).toBeCloseTo(0.6, 12);
    expect(f.last_run_at).toBe('2030-01-18T12:00:00.000Z');
    expect(s.agent).toEqual({ id: ids.A, name: 'Alpha' });
    expect(s.cost_by_model).toEqual([
      { provider: 'openai', model: 'gpt-4o', runs: 2, cost_usd: expect.closeTo(0.3, 12) },
      { provider: null, model: null, runs: 1, cost_usd: 0.05 },
    ]);
  });

  it('R-07: an all-unpriced agent reports null costs', async () => {
    const s = await stats(ids.B);
    expect(s.figures.runs).toBe(2);
    expect(s.figures.total_cost_usd).toBeNull();
    expect(s.figures.avg_cost_usd).toBeNull();
    expect(s.figures.avg_duration_ms).toBeNull();
    expect(s.figures.accept_rate).toBeNull();
    expect(s.comparison.cost_delta_usd).toBeNull();
    expect(s.comparison.accept_trend).toBeNull();
    expect(s.cost_by_model).toEqual([]);
  });

  it('R-14, R-93, D-20: echoes the range; previous window counted by the same rules', async () => {
    const s = await stats(ids.A);
    expect(s.range).toEqual({ from: FROM, to: TO, tz: 'UTC', previous: { from: PREV_FROM, to: FROM } });
    // p1 at exactly previous.from counts; the run 1 ms earlier does not; r1 at from is current only.
    expect(s.comparison.previous_runs).toBe(1);
    expect(s.comparison.previous_total_cost_usd).toBe(1);
    expect(s.comparison.previous_decided).toBe(2);
    expect(s.comparison.previous_accept_rate).toBe(0.5);
    expect(s.comparison.cost_delta_usd).toBeCloseTo(0.35 - 1, 12);
    expect(s.comparison.accept_trend).toBe('up'); // 60 % vs 50 %
  });

  it('R-15…R-24: dashboard rows, totals, breakdowns', async () => {
    const r = await dashboard();
    // every agent, enabled or disabled, with or without runs, plus the deleted row
    const byId = new Map(r.agents.map((x) => [x.agent_id, x]));
    expect([...byId.keys()].sort()).toEqual([ids.A, ids.B, ids.C, null].sort());
    expect(byId.get(ids.B)!.enabled).toBe(false);
    expect(byId.get(ids.C)!.figures.runs).toBe(0);
    expect(byId.get(ids.C)!.figures.last_run_at).toBeNull();
    const deleted = byId.get(null)!;
    expect(deleted.kind).toBe('deleted');
    expect(deleted.figures.runs).toBe(1);
    expect(deleted.figures.accepted).toBe(1);

    expect(r.totals.runs).toBe(7);
    expect(r.totals.unpriced_runs).toBe(3);
    expect(r.totals.total_cost_usd).toBeCloseTo(0.75, 12);
    expect(r.totals.accepted).toBe(4);
    expect(r.totals.decided).toBe(6);
    expect(r.totals.accept_rate).toBeCloseTo(4 / 6, 12);
    const total = r.totals.total_cost_usd!;
    expect(Math.abs(total - r.cost_by_agent.reduce((s, x) => s + x.cost_usd, 0))).toBeLessThan(1e-9);
    expect(Math.abs(total - r.cost_by_model.reduce((s, x) => s + x.cost_usd, 0))).toBeLessThan(1e-9);

    expect(r.most_active_agent_id).toBe(ids.A);
    expect(r.cost_by_agent.map((x) => [x.kind, x.agent_id])).toEqual([
      ['deleted', null],
      ['agent', ids.A],
    ]);
    expect(r.cost_by_model.map((x) => [x.provider, x.model, x.runs])).toEqual([
      ['openai', 'gpt-4o', 3],
      [null, null, 1],
    ]);
  });

  it('R-27: unknown and foreign agent ids are 404', async () => {
    for (const id of ['00000000-0000-4000-8000-000000000000', ids.FA, ids.D]) {
      const res = await app.inject({ method: 'GET', url: `/agents/${id}/stats?${Q}&tz=UTC` });
      expect(res.statusCode).toBe(404);
    }
  });

  it('R-28, D-2, D-19: bad ranges, zones and buckets are 422 on both routes; /agents/performance is not /agents/:id', async () => {
    const bad = [
      `from=${encodeURIComponent(FROM)}&tz=UTC`,
      `from=garbage&to=${encodeURIComponent(TO)}&tz=UTC`,
      `from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(FROM)}&tz=UTC`,
      `from=${encodeURIComponent(TO)}&to=${encodeURIComponent(FROM)}&tz=UTC`,
      `${Q}`,
      `${Q}&tz=Not/AZone`,
      `${Q}&tz=`,
      `${Q}&tz=UTC&bucket=week`,
      // F-09: a bare offset is not an IANA name (Postgres would read '+05' as POSIX, sign inverted)
      `${Q}&tz=%2B05`,
      `${Q}&tz=%2B0530`,
      // F-08: nothing Postgres cannot hold — year 0, and a previous window that would start before 1970
      `from=${encodeURIComponent('0000-01-01T00:00:00Z')}&to=${encodeURIComponent(TO)}&tz=UTC`,
      `from=${encodeURIComponent('1990-01-01T00:00:00Z')}&to=${encodeURIComponent(TO)}&tz=UTC`,
      `from=${encodeURIComponent('1970-01-02T00:00:00Z')}&to=${encodeURIComponent('1970-01-03T00:00:00.001Z')}&tz=UTC`,
    ];
    for (const qs of bad) {
      for (const path of ['/agents/performance', `/agents/${ids.A}/stats`]) {
        const res = await app.inject({ method: 'GET', url: `${path}?${qs}` });
        expect(res.statusCode, `${path}?${qs}`).toBe(422);
      }
    }
    const ok = await app.inject({ method: 'GET', url: `/agents/performance?${Q}&tz=UTC` });
    expect(ok.statusCode).toBe(200);
    // The earliest allowed range: the previous window starts at exactly 1970-01-01T00:00:00Z.
    const edge = await app.inject({
      method: 'GET',
      url: `/agents/performance?from=${encodeURIComponent('1970-01-02T00:00:00Z')}&to=${encodeURIComponent('1970-01-03T00:00:00Z')}&tz=UTC`,
    });
    expect(edge.statusCode, edge.body).toBe(200);
  });

  it('F-09: a zone Node accepts but Postgres does not is a 422 on both routes, with or without runs, not a 500', async () => {
    // 'US/Pacific-New' left the tz database in 2020b; Node's ICU still knows it, pg16 does not.
    expect(() => new Intl.DateTimeFormat('en-US', { timeZone: 'US/Pacific-New' })).not.toThrow();
    const tz = `tz=${encodeURIComponent('US/Pacific-New')}`;
    // A window with no counted runs in either half: only the probe can reject the zone.
    const EMPTY_Q = `from=${encodeURIComponent('2040-01-11T00:00:00.000Z')}&to=${encodeURIComponent('2040-01-21T00:00:00.000Z')}`;
    const emptyOk = await app.inject({ method: 'GET', url: `/agents/performance?${EMPTY_Q}&tz=UTC` });
    expect(emptyOk.statusCode, emptyOk.body).toBe(200);
    expect(AgentPerformanceReport.parse(emptyOk.json()).totals.runs).toBe(0);
    for (const q of [Q, EMPTY_Q]) {
      for (const url of [`/agents/performance?${q}&${tz}`, `/agents/${ids.A}/stats?${q}&${tz}`]) {
        const res = await app.inject({ method: 'GET', url });
        expect(res.statusCode, `${url} → ${res.body}`).toBe(422);
        expect(res.json().error.code).toBe('validation_error');
        expect(res.json().error.details).toMatchObject({ field: 'tz', value: 'US/Pacific-New' });
      }
    }
  });

  it('R-29: both reads use stored rows only — no calls, no writes', async () => {
    const db = pg.handle.db;
    const snapshot = async () => ({
      runs: (await db.select({ n: count() }).from(t.agentRuns))[0]!.n,
      reviews: (await db.select({ n: count() }).from(t.reviews))[0]!.n,
      findings: (await db.select({ n: count() }).from(t.findings))[0]!.n,
      jobs: (await db.select({ n: count() }).from(t.jobs))[0]!.n,
      states: await db
        .select({ id: t.findings.id, a: t.findings.acceptedAt, d: t.findings.dismissedAt })
        .from(t.findings)
        .orderBy(t.findings.id),
    });
    const before = await snapshot();
    const llmBefore = llm.calls.length + llm2.calls.length;
    const ghBefore = gh.calls();
    await dashboard();
    await stats(ids.A);
    expect(await snapshot()).toEqual(before);
    expect(llm.calls.length + llm2.calls.length).toBe(llmBefore);
    expect(gh.calls()).toBe(ghBefore);
  });

  it('R-30: the foreign workspace never shows up in W', async () => {
    const r = await dashboard();
    expect(r.agents.some((x) => x.agent_id === ids.FA)).toBe(false);
    // F's run on A's id and F's review on r1 are excluded (A stays at 4 runs, 3/5 decided).
    const a = r.agents.find((x) => x.agent_id === ids.A)!;
    expect(a.figures.runs).toBe(4);
    expect(a.figures.decided).toBe(5);
    expect(r.totals.total_cost_usd!).toBeLessThan(1);
  });

  it('R-90, R-91, D-18, D-19: run buckets per local day / hour', async () => {
    const utc = await dashboard('tz=UTC');
    expect(utc.totals.bucket_unit).toBe('day');
    expect(utc.totals.run_buckets).toEqual([
      { key: '2030-01-11', runs: 1 },
      { key: '2030-01-12', runs: 1 },
      { key: '2030-01-13', runs: 1 },
      { key: '2030-01-14', runs: 1 },
      { key: '2030-01-15', runs: 1 },
      { key: '2030-01-16', runs: 1 },
      { key: '2030-01-18', runs: 1 },
    ]);
    // Kyiv is UTC+2 in January: r2 (23:30Z on the 15th) lands on the 16th.
    const kyiv = await dashboard(`tz=${encodeURIComponent('Europe/Kyiv')}`);
    expect(kyiv.range.tz).toBe('Europe/Kyiv');
    expect(kyiv.totals.run_buckets.find((b) => b.key === '2030-01-16')!.runs).toBe(2);
    expect(kyiv.totals.run_buckets.some((b) => b.key === '2030-01-15')).toBe(false);
    expect(kyiv.totals.run_buckets.reduce((s, b) => s + b.runs, 0)).toBe(kyiv.totals.runs);

    const hourUtc = await dashboard('tz=UTC&bucket=hour');
    expect(hourUtc.totals.bucket_unit).toBe('hour');
    expect(hourUtc.totals.run_buckets[0]).toEqual({ key: '2030-01-11T00', runs: 1 });
    expect(hourUtc.totals.run_buckets.every((b) => /^\d{4}-\d{2}-\d{2}T\d{2}$/.test(b.key))).toBe(true);
    expect(hourUtc.totals.run_buckets.reduce((s, b) => s + b.runs, 0)).toBe(hourUtc.totals.runs);
    const hourKyiv = await dashboard(`tz=${encodeURIComponent('Europe/Kyiv')}&bucket=hour`);
    expect(hourKyiv.totals.run_buckets[0]).toEqual({ key: '2030-01-11T02', runs: 1 });
  });

  it('keeps the read workspace-scoped at the SQL level (sanity: F has its own numbers)', async () => {
    const [row] = await pg.handle.db
      .select({ n: sql<number>`count(*)::int` })
      .from(t.agentRuns)
      .where(eq(t.agentRuns.workspaceId, F.workspaceId));
    expect(row!.n).toBe(2);
  });
});
