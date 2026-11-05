/**
 * L08 follow-up — Skill Stats against a real Postgres.
 *   GET /skills/:id/stats, GET /skills/pull-frequency, and the `findings`
 *   field of GET /agents/:id/stats.
 * Cases I1–I20 of specs/L08-skill-stats.decisions.md §C.
 *
 * Range under test: [2030-01-11, 2030-01-21) UTC. Far from any real data, all
 * instants explicit. Fixture (workspace W):
 *   PRs P1, P2; skills S1 'conventions' (on), S2 'off-skill' (off globally),
 *   S3 'solo' (only C), S4 'temp' (attached and detached by I2).
 *   Agents Alpha (S1 + S2 checked), Beta (S1 row unchecked), Delta (disabled
 *   agent, S1 checked, no run), Echo (S1 checked), Gamma (S3 only), and Xray
 *   (S1 checked, ran on P2, then deleted).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, count, eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { MockAuthProvider, MockGitHubClient, MockLLMProvider } from '../src/adapters/mocks.js';
import * as t from '../src/db/schema.js';
import { AgentStatsReport, SkillStatsReport, SkillsPullFrequencyReport } from '@devdigest/shared';
import type { GitHubClient } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
type Db = PgFixture['handle']['db'];

const FROM = '2030-01-11T00:00:00.000Z';
const TO = '2030-01-21T00:00:00.000Z';
const Q = `from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}&tz=UTC`;
/** A 30-day range around the fixture (I11). */
const Q30 = `from=${encodeURIComponent('2030-01-01T00:00:00.000Z')}&to=${encodeURIComponent('2030-01-31T00:00:00.000Z')}&tz=UTC`;
/** A range with no run at all (I7, I15). */
const EMPTY_Q = `from=${encodeURIComponent('2040-01-11T00:00:00.000Z')}&to=${encodeURIComponent('2040-01-21T00:00:00.000Z')}`;

type FindingState = 'accepted' | 'dismissed' | 'both' | 'pending';
interface SeedFinding {
  state: FindingState;
  category: string;
  severity: string;
  kind?: string;
}

interface Ctx {
  db: Db;
  workspaceId: string;
  p1: string;
  p2: string;
}

async function makeWorkspace(db: Db, name: string): Promise<Ctx> {
  const [ws] = await db.insert(t.workspaces).values({ name }).returning();
  const [repo] = await db
    .insert(t.repos)
    .values({ workspaceId: ws!.id, owner: 'acme', name, fullName: `acme/${name}` })
    .returning();
  const pr = async (number: number) => {
    const [row] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId: ws!.id,
        repoId: repo!.id,
        number,
        title: `PR ${number}`,
        author: 'dev',
        branch: `b${number}`,
        base: 'main',
        headSha: `sha${number}`,
      })
      .returning();
    return row!.id;
  };
  return { db, workspaceId: ws!.id, p1: await pr(1), p2: await pr(2) };
}

async function insertAgent(c: Ctx, name: string, enabled = true): Promise<string> {
  const [a] = await c.db
    .insert(t.agents)
    .values({ workspaceId: c.workspaceId, name, provider: 'openai', model: 'gpt-4o', systemPrompt: 'p', enabled })
    .returning({ id: t.agents.id });
  return a!.id;
}

async function insertSkill(c: Ctx, name: string, enabled = true): Promise<string> {
  const [s] = await c.db
    .insert(t.skills)
    .values({ workspaceId: c.workspaceId, name, description: 'd', type: 'custom', source: 'manual', body: 'b', enabled })
    .returning({ id: t.skills.id });
  return s!.id;
}

async function link(db: Db, agentId: string, skillId: string, enabled = true): Promise<void> {
  await db.insert(t.agentSkills).values({ agentId, skillId, enabled });
}

async function insertRun(
  c: Ctx,
  v: { agentId: string | null; prId: string | null; ranAt: string; status?: string; source?: 'local' | 'ci' },
): Promise<string> {
  const [row] = await c.db
    .insert(t.agentRuns)
    .values({
      workspaceId: c.workspaceId,
      agentId: v.agentId,
      prId: v.prId,
      ranAt: new Date(v.ranAt),
      status: v.status ?? 'done',
      provider: 'openai',
      model: 'gpt-4o',
      source: v.source ?? 'local',
    })
    .returning({ id: t.agentRuns.id });
  return row!.id;
}

async function addReview(c: Ctx, runId: string, agentId: string | null, prId: string, findings: SeedFinding[]): Promise<void> {
  const [review] = await c.db
    .insert(t.reviews)
    .values({ workspaceId: c.workspaceId, prId, agentId, runId, kind: 'review' })
    .returning({ id: t.reviews.id });
  if (findings.length === 0) return;
  const at = new Date('2030-02-01T00:00:00Z');
  await c.db.insert(t.findings).values(
    findings.map((f, i) => ({
      reviewId: review!.id,
      file: 'a.ts',
      startLine: i + 1,
      endLine: i + 1,
      severity: f.severity,
      category: f.category,
      title: `f${i}`,
      rationale: 'r',
      confidence: 0.9,
      kind: f.kind ?? 'finding',
      acceptedAt: f.state === 'accepted' || f.state === 'both' ? at : null,
      dismissedAt: f.state === 'dismissed' || f.state === 'both' ? at : null,
    })),
  );
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

const ZERO_FINDINGS = {
  total: 0,
  by_category: { security: 0, bug: 0, perf: 0, style: 0, test: 0, other: 0 },
  by_severity: { CRITICAL: 0, WARNING: 0, SUGGESTION: 0, other: 0 },
};

d('skill stats reads (Testcontainers pg)', () => {
  let pg: PgFixture;
  let app: FastifyInstance;
  let W: Ctx;
  let F: Ctx;
  let ids: {
    A: string;
    B: string;
    C: string;
    D: string;
    E: string;
    S1: string;
    S2: string;
    S3: string;
    S4: string;
    FS: string;
  };
  const llm = new MockLLMProvider('openai');
  const gh = countingGitHub();

  beforeAll(async () => {
    pg = await startPg();
    const db = pg.handle.db;
    W = await makeWorkspace(db, 'skill-w');
    F = await makeWorkspace(db, 'skill-f');

    const S1 = await insertSkill(W, 'conventions');
    const S2 = await insertSkill(W, 'off-skill', false);
    const S3 = await insertSkill(W, 'solo');
    const S4 = await insertSkill(W, 'temp');

    const A = await insertAgent(W, 'Alpha');
    const B = await insertAgent(W, 'Beta');
    const C = await insertAgent(W, 'Gamma');
    const D = await insertAgent(W, 'Delta', false);
    const E = await insertAgent(W, 'Echo');
    const X = await insertAgent(W, 'Xray');
    await link(db, A, S1);
    await link(db, A, S2);
    await link(db, B, S1, false);
    await link(db, D, S1);
    await link(db, E, S1);
    await link(db, C, S3);
    await link(db, X, S1);

    // ---- Alpha: 3 counted runs (at `from`, a ci run, a null-PR run) ----
    const r1 = await insertRun(W, { agentId: A, prId: W.p1, ranAt: FROM });
    await addReview(W, r1, A, W.p1, [
      { state: 'accepted', category: 'security', severity: 'CRITICAL' },
      { state: 'dismissed', category: 'bug', severity: 'WARNING' },
      { state: 'both', category: 'security', severity: 'CRITICAL', kind: 'secret_leak' }, // accepted wins
      { state: 'pending', category: 'misc', severity: 'SUGGESTION' }, // category → other
      { state: 'pending', category: 'perf', severity: 'warning' }, // severity → other
    ]);
    const r2 = await insertRun(W, { agentId: A, prId: W.p1, ranAt: '2030-01-15T10:00:00Z', source: 'ci' });
    await addReview(W, r2, A, W.p1, [{ state: 'accepted', category: 'test', severity: 'SUGGESTION' }]);
    const rNull = await insertRun(W, { agentId: A, prId: null, ranAt: '2030-01-16T10:00:00Z' });
    await addReview(W, rNull, A, W.p1, [{ state: 'dismissed', category: 'style', severity: 'WARNING' }]);
    // not counted: failed (with a finding), running, at exactly `to`, previous window (P2)
    const failed = await insertRun(W, { agentId: A, prId: W.p2, ranAt: '2030-01-12T00:00:00Z', status: 'failed' });
    await addReview(W, failed, A, W.p2, [{ state: 'accepted', category: 'bug', severity: 'CRITICAL' }]);
    await insertRun(W, { agentId: A, prId: W.p2, ranAt: '2030-01-12T00:00:00Z', status: 'running' });
    await insertRun(W, { agentId: A, prId: W.p2, ranAt: TO });
    await insertRun(W, { agentId: A, prId: W.p1, ranAt: '2030-01-05T00:00:00Z' });

    // ---- Echo: one run on P1 (same PR as Alpha) ----
    const e1 = await insertRun(W, { agentId: E, prId: W.p1, ranAt: '2030-01-17T10:00:00Z' });
    await addReview(W, e1, E, W.p1, [{ state: 'pending', category: 'bug', severity: 'WARNING' }]);

    // ---- Beta (S1 row unchecked): a run on P2 — never S1's ----
    const b1 = await insertRun(W, { agentId: B, prId: W.p2, ranAt: '2030-01-13T10:00:00Z' });
    await addReview(W, b1, B, W.p2, [{ state: 'accepted', category: 'bug', severity: 'WARNING' }]);

    // ---- Gamma (S3 only): a run on P2 ----
    const c1 = await insertRun(W, { agentId: C, prId: W.p2, ranAt: '2030-01-14T10:00:00Z' });
    await addReview(W, c1, C, W.p2, [
      { state: 'accepted', category: 'bug', severity: 'WARNING' },
      { state: 'dismissed', category: 'perf', severity: 'SUGGESTION' },
      { state: 'pending', category: 'security', severity: 'CRITICAL' },
    ]);

    // ---- Xray used S1 and ran on P2, then was deleted: agent_id becomes null ----
    const x1 = await insertRun(W, { agentId: X, prId: W.p2, ranAt: '2030-01-18T10:00:00Z' });
    await addReview(W, x1, X, W.p2, [{ state: 'accepted', category: 'bug', severity: 'WARNING' }]);
    await db.delete(t.agents).where(eq(t.agents.id, X));

    // ---- Foreign workspace F: same shape, plus cross-workspace traps ----
    const FS = await insertSkill(F, 'conventions');
    const FA = await insertAgent(F, 'Foreign');
    await link(db, FA, FS);
    await link(db, FA, S1); // F's agent linked to W's skill (inserted directly)
    const f1 = await insertRun(F, { agentId: FA, prId: F.p1, ranAt: '2030-01-15T00:00:00Z' });
    await addReview(F, f1, FA, F.p1, [{ state: 'accepted', category: 'bug', severity: 'WARNING' }]);
    await insertRun(F, { agentId: A, prId: F.p2, ranAt: '2030-01-15T00:00:00Z' }); // F run on W's agent
    await addReview(F, r1, A, F.p1, [{ state: 'accepted', category: 'bug', severity: 'WARNING' }]); // F review on W's run

    ids = { A, B, C, D, E, S1, S2, S3, S4, FS };

    app = await buildApp({
      config: config(),
      db,
      overrides: {
        auth: new MockAuthProvider(undefined, { id: W.workspaceId, name: 'skill-w' }),
        github: gh.client,
        llm: { openai: llm, anthropic: llm, openrouter: llm },
      },
    });
  });

  afterAll(async () => {
    await app?.close();
    await pg?.stop();
  });

  async function skillStats(id: string, q = Q): Promise<SkillStatsReport> {
    const res = await app.inject({ method: 'GET', url: `/skills/${id}/stats?${q}` });
    expect(res.statusCode, res.body).toBe(200);
    return SkillStatsReport.parse(res.json());
  }
  async function pullFreq(q = Q): Promise<SkillsPullFrequencyReport> {
    const res = await app.inject({ method: 'GET', url: `/skills/pull-frequency?${q}` });
    expect(res.statusCode, res.body).toBe(200);
    return SkillsPullFrequencyReport.parse(res.json());
  }
  async function agentStats(id: string): Promise<AgentStatsReport> {
    const res = await app.inject({ method: 'GET', url: `/agents/${id}/stats?${Q}&bucket=day` });
    expect(res.statusCode, res.body).toBe(200);
    return AgentStatsReport.parse(res.json());
  }

  it('I1 R-01, R-05: used_by counts the agents using the skill now and equals GET /skills agent_count', async () => {
    const s = await skillStats(ids.S1);
    expect(s.used_by).toBe(3); // Alpha, Delta (disabled agent), Echo — not Beta (unchecked), not Xray (deleted), not F's agent
    const res = await app.inject({ method: 'GET', url: '/skills' });
    expect(res.statusCode).toBe(200);
    const list = res.json() as { id: string; agent_count: number }[];
    expect(list.find((x) => x.id === ids.S1)!.agent_count).toBe(s.used_by);
  });

  it('I2 R-02: attribution follows the current attachment — attach counts past runs, detach removes them', async () => {
    const db = pg.handle.db;
    const before = await skillStats(ids.S4);
    expect(before.used_by).toBe(0);
    expect(before.pull_frequency.prs_with_skill).toBe(0);
    await link(db, ids.A, ids.S4);
    try {
      const attached = await skillStats(ids.S4);
      expect(attached.used_by).toBe(1);
      expect(attached.agents.map((a) => [a.id, a.runs])).toEqual([[ids.A, 3]]);
      expect(attached.pull_frequency.prs_with_skill).toBe(1);
      expect(attached.findings.total).toBe(7);
    } finally {
      await db.delete(t.agentSkills).where(and(eq(t.agentSkills.agentId, ids.A), eq(t.agentSkills.skillId, ids.S4)));
    }
    const detached = await skillStats(ids.S4);
    expect(detached.used_by).toBe(0);
    expect(detached.agents).toEqual([]);
    expect(detached.findings.total).toBe(0);
    expect(detached.pull_frequency.prs_with_skill).toBe(0);
  });

  it('I3 R-03: done runs in [from, to) only, any source', async () => {
    const s = await skillStats(ids.S1);
    // Alpha: r1 (at from), r2 (ci), rNull — not failed / running / at `to` / previous window
    expect(s.agents.find((a) => a.id === ids.A)!.runs).toBe(3);
  });

  it('I4 R-04, R-07: a deleted agent run is never attributed, but its PR is reviewed', async () => {
    const s = await skillStats(ids.S1);
    expect(s.agents.map((a) => a.id)).not.toContain(null);
    // Xray's accepted finding on P2 is not in S1's figures: Alpha 3 + Echo 0 accepted
    expect(s.figures.accepted).toBe(3);
    expect(s.pull_frequency.prs_reviewed).toBe(2); // P1 and P2
  });

  it('I5 R-06, R-79: ran_in_period counts agents with a run; zero-run agents stay in the list', async () => {
    const s = await skillStats(ids.S1);
    expect(s.ran_in_period).toBe(2);
    expect(s.agents.map((a) => [a.name, a.runs])).toEqual([
      ['Alpha', 3],
      ['Delta', 0],
      ['Echo', 1],
    ]);
  });

  it('I6 R-07…R-09: distinct PRs; two using agents on one PR count once; null-PR runs in neither count', async () => {
    const s = await skillStats(ids.S1);
    expect(s.pull_frequency).toEqual({ prs_with_skill: 1, prs_reviewed: 2, rate: 0.5 });
    const solo = await skillStats(ids.S3);
    expect(solo.pull_frequency).toEqual({ prs_with_skill: 1, prs_reviewed: 2, rate: 0.5 });
  });

  it('I7 R-10: a range with no run → 0/0 and rate null on both reads', async () => {
    const q = `${EMPTY_Q}&tz=UTC`;
    const s = await skillStats(ids.S1, q);
    expect(s.pull_frequency).toEqual({ prs_with_skill: 0, prs_reviewed: 0, rate: null });
    expect(s.ran_in_period).toBe(0);
    expect(s.used_by).toBe(3);
    expect(s.figures.accept_rate).toBeNull();
    expect(s.findings).toEqual(ZERO_FINDINGS);
    const p = await pullFreq(q);
    expect(p.skills.every((x) => x.pull_frequency.rate === null && x.pull_frequency.prs_reviewed === 0)).toBe(true);
  });

  it('I8 R-11…R-15: every kind and state counts; unknown category/severity → other; sums agree', async () => {
    const s = await skillStats(ids.S1);
    // Alpha (7) + Echo (1)
    expect(s.figures).toEqual({ accepted: 3, dismissed: 2, pending: 3, decided: 5, accept_rate: 0.6 });
    expect(s.findings).toEqual({
      total: 8,
      by_category: { security: 2, bug: 2, perf: 1, style: 1, test: 1, other: 1 },
      by_severity: { CRITICAL: 2, WARNING: 3, SUGGESTION: 2, other: 1 },
    });
    const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
    expect(sum(s.findings.by_category)).toBe(s.findings.total);
    expect(sum(s.findings.by_severity)).toBe(s.findings.total);
    expect(s.figures.accepted + s.figures.dismissed + s.figures.pending).toBe(s.findings.total);
  });

  it("I9 R-16: a single-agent skill equals that agent's stats field by field", async () => {
    const s = await skillStats(ids.S3);
    const c = await agentStats(ids.C);
    expect(s.used_by).toBe(1);
    const { accepted, dismissed, pending, decided, accept_rate } = c.figures;
    expect(s.figures).toEqual({ accepted, dismissed, pending, decided, accept_rate });
    expect(s.findings).toEqual(c.findings);
    expect(s.findings.total).toBe(3);
  });

  it('I10 R-17: both reads echo from, to and tz', async () => {
    const kyiv = `from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}&tz=${encodeURIComponent('Europe/Kyiv')}`;
    const s = await skillStats(ids.S1, kyiv);
    const p = await pullFreq(kyiv);
    for (const r of [s.range, p.range]) {
      expect(r.from).toBe(FROM);
      expect(r.to).toBe(TO);
      expect(r.tz).toBe('Europe/Kyiv');
    }
  });

  it('I11 R-18, R-72, R-78: every pull-frequency entry deep-equals its stats read over 30 days', async () => {
    const p = await pullFreq(Q30);
    expect(p.skills).toHaveLength(4);
    for (const entry of p.skills) {
      const s = await skillStats(entry.skill_id, Q30);
      expect(entry.pull_frequency, entry.skill_id).toEqual(s.pull_frequency);
    }
  });

  it('I12 R-19, R-20, R-42: agent rows {id, name, enabled, runs} name asc; one pull-frequency entry per skill', async () => {
    const s = await skillStats(ids.S1);
    expect(s.skill).toEqual({ id: ids.S1, name: 'conventions', enabled: true });
    expect(s.agents).toEqual([
      { id: ids.A, name: 'Alpha', enabled: true, runs: 3 },
      { id: ids.D, name: 'Delta', enabled: false, runs: 0 },
      { id: ids.E, name: 'Echo', enabled: true, runs: 1 },
    ]);
    const p = await pullFreq();
    // name asc: conventions, off-skill, solo, temp — S3 and S4 included
    expect(p.skills.map((x) => x.skill_id)).toEqual([ids.S1, ids.S2, ids.S3, ids.S4]);
    expect(p.skills.find((x) => x.skill_id === ids.S4)!.pull_frequency).toEqual({
      prs_with_skill: 0,
      prs_reviewed: 2,
      rate: 0,
    });
  });

  it('I13 R-21: unknown or foreign skill id → 404; non-uuid → 422', async () => {
    for (const id of ['00000000-0000-4000-8000-000000000000', ids.FS]) {
      const res = await app.inject({ method: 'GET', url: `/skills/${id}/stats?${Q}` });
      expect(res.statusCode, id).toBe(404);
    }
    const bad = await app.inject({ method: 'GET', url: `/skills/not-a-uuid/stats?${Q}` });
    expect(bad.statusCode).toBe(422);
  });

  it('I14 R-22: bad ranges are 422 on both routes', async () => {
    const bad = [
      `from=${encodeURIComponent(FROM)}&tz=UTC`,
      `from=${encodeURIComponent(FROM)}&to=garbage&tz=UTC`,
      `from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(FROM)}&tz=UTC`,
      `from=${encodeURIComponent(TO)}&to=${encodeURIComponent(FROM)}&tz=UTC`,
      `from=${encodeURIComponent('1970-01-02T00:00:00Z')}&to=${encodeURIComponent('1970-01-03T00:00:00.001Z')}&tz=UTC`,
      `from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`,
    ];
    for (const qs of bad) {
      for (const path of ['/skills/pull-frequency', `/skills/${ids.S1}/stats`]) {
        const res = await app.inject({ method: 'GET', url: `${path}?${qs}` });
        expect(res.statusCode, `${path}?${qs}`).toBe(422);
      }
    }
  });

  it('F-02: a `to` past 9999-12-31T23:59:59.999Z is 422, not a Postgres 500; the last instant is 200', async () => {
    const paths = ['/skills/pull-frequency', `/skills/${ids.S1}/stats`, '/agents/performance', `/agents/${ids.A}/stats`];
    // -14:00 normalises to +010000-01-01T13:59:59Z — beyond what Postgres can hold
    const late = `from=${encodeURIComponent('9999-12-30T00:00:00Z')}&to=${encodeURIComponent('9999-12-31T23:59:59-14:00')}&tz=UTC`;
    const justAfter = `from=${encodeURIComponent('9999-12-30T00:00:00Z')}&to=${encodeURIComponent('10000-01-01T00:00:00Z')}&tz=UTC`;
    const inside = `from=${encodeURIComponent('9999-12-30T00:00:00Z')}&to=${encodeURIComponent('9999-12-31T23:59:59.999Z')}`;
    for (const path of paths) {
      for (const qs of [late, justAfter]) {
        const res = await app.inject({ method: 'GET', url: `${path}?${qs}` });
        expect(res.statusCode, `${path}?${qs} → ${res.body}`).toBe(422);
      }
      for (const tz of ['UTC', 'Pacific/Kiritimati']) {
        const res = await app.inject({ method: 'GET', url: `${path}?${inside}&tz=${encodeURIComponent(tz)}` });
        expect(res.statusCode, `${path}?${inside}&tz=${tz} → ${res.body}`).toBe(200);
      }
    }
  });

  it('I15 R-23:a zone Postgres does not know is 422 on both routes, also on an empty range', async () => {
    const tz = `tz=${encodeURIComponent('US/Pacific-New')}`;
    for (const q of [`from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`, EMPTY_Q]) {
      for (const url of [`/skills/pull-frequency?${q}&${tz}`, `/skills/${ids.S1}/stats?${q}&${tz}`]) {
        const res = await app.inject({ method: 'GET', url });
        expect(res.statusCode, `${url} → ${res.body}`).toBe(422);
        expect(res.json().error.code).toBe('validation_error');
        expect(res.json().error.details).toMatchObject({ field: 'tz', value: 'US/Pacific-New' });
      }
    }
    // the probe runs before the skill lookup: an unknown skill with a bad zone is still a 422
    const res = await app.inject({
      method: 'GET',
      url: `/skills/00000000-0000-4000-8000-000000000000/stats?${EMPTY_Q}&${tz}`,
    });
    expect(res.statusCode).toBe(422);
  });

  it('I16 R-24: stored rows only — no calls, no writes', async () => {
    const db = pg.handle.db;
    const n = async (q: PromiseLike<{ n: number }[]>) => (await q)[0]!.n;
    const snapshot = async () => ({
      runs: await n(db.select({ n: count() }).from(t.agentRuns)),
      reviews: await n(db.select({ n: count() }).from(t.reviews)),
      findings: await n(db.select({ n: count() }).from(t.findings)),
      agentSkills: await n(db.select({ n: count() }).from(t.agentSkills)),
      skills: await n(db.select({ n: count() }).from(t.skills)),
      agents: await n(db.select({ n: count() }).from(t.agents)),
      jobs: await n(db.select({ n: count() }).from(t.jobs)),
      states: await db
        .select({ id: t.findings.id, a: t.findings.acceptedAt, d: t.findings.dismissedAt })
        .from(t.findings)
        .orderBy(t.findings.id),
    });
    const before = await snapshot();
    const llmBefore = llm.calls.length;
    const ghBefore = gh.calls();
    await skillStats(ids.S1);
    await pullFreq();
    await agentStats(ids.A);
    expect(await snapshot()).toEqual(before);
    expect(llm.calls.length).toBe(llmBefore);
    expect(gh.calls()).toBe(ghBefore);
  });

  it('I17 R-25: the foreign workspace is never counted', async () => {
    const s = await skillStats(ids.S1);
    // F's agent linked to W's S1 is not a user; F's PRs are not reviewed in W
    expect(s.used_by).toBe(3);
    expect(s.pull_frequency.prs_reviewed).toBe(2);
    // F's review hanging off W's run r1 adds nothing (Alpha + Echo = 8)
    expect(s.findings.total).toBe(8);
    const p = await pullFreq();
    expect(p.skills.map((x) => x.skill_id)).not.toContain(ids.FS);
    // F's run on W's agent Alpha is not one of Alpha's runs
    expect(s.agents.find((a) => a.id === ids.A)!.runs).toBe(3);
  });

  it('I18 R-26, R-68: agent stats carry the findings breakdown as seeded', async () => {
    const a = await agentStats(ids.A);
    expect(a.findings).toEqual({
      total: 7,
      by_category: { security: 2, bug: 1, perf: 1, style: 1, test: 1, other: 1 },
      by_severity: { CRITICAL: 2, WARNING: 2, SUGGESTION: 2, other: 1 },
    });
    expect(a.findings.total).toBe(a.figures.accepted + a.figures.dismissed + a.figures.pending);
  });

  it('I19 R-48: a skill that is off globally has no users and no figures', async () => {
    const s = await skillStats(ids.S2);
    expect(s.skill.enabled).toBe(false);
    expect(s.used_by).toBe(0);
    expect(s.agents).toEqual([]);
    expect(s.pull_frequency.prs_with_skill).toBe(0);
    expect(s.findings).toEqual(ZERO_FINDINGS);
  });

  it('I20 D-1: /skills/pull-frequency is not captured by /skills/:id', async () => {
    const res = await app.inject({ method: 'GET', url: `/skills/pull-frequency?${Q}` });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.skills)).toBe(true);
    expect(SkillsPullFrequencyReport.safeParse(body).success).toBe(true);
  });
});
