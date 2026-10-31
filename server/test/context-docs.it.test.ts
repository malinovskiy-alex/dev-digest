import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import type { Review } from '@devdigest/shared';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { waitForPrRuns } from './helpers/runs.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import {
  AgentContextDocs,
  ContextDocContent,
  ContextDocList,
  SkillContextDocs,
} from '@devdigest/shared';
import { MockEmbedder, MockGitClient, MockLLMProvider } from '../src/adapters/mocks.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[context-docs] Docker not available — skipping integration tests.');
}

/**
 * L05 project context end to end against a real Postgres: the attachment
 * routes (persistence, order, parked rows, validation, tenancy, no version
 * bump), "Used by N", and what a review run actually puts into the prompt,
 * the trace and the run log.
 *
 * The claim no unit test can make is that the three reads of "what an agent
 * gets through its skills" — the Context tab's inherited rows, the prompt's
 * skill bodies + docs, and "Used by N" — follow ONE gate (`activeSkillOnAgent`).
 * A skill off globally and a skill unchecked on the agent are each checked in
 * all three places, next to a positive control that does reach all three.
 */

const DIFF = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,3 +10,4 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;

const REVIEW: Review = { verdict: 'approve', summary: 'ok', score: 100, findings: [] };
const INTENT = {
  intent: 'Add a key.',
  kind: 'feature',
  in_scope: ['src/config.ts'],
  out_of_scope: [],
  risk_areas: [],
  conflicts: [],
  ambiguous: false,
};

const BIG = 'B'.repeat(40_000);
/** The clone's tree, shared by every repo in this file (MockGitClient ignores the repo). */
const FILES: Record<string, string> = {
  'docs/agent-a.md': 'AGENT-A-TEXT',
  'docs/big.md': BIG,
  'docs/skill-x.md': 'SKILL-X-TEXT',
  'docs/off.md': 'OFF-SKILL-DOC-TEXT',
  'docs/unchecked.md': 'UNCHECKED-SKILL-DOC-TEXT',
  'docs/active.md': 'ACTIVE-SKILL-DOC-TEXT',
  'docs/u1.md': 'u1',
  'docs/u2.md': 'u2',
  'docs/u3.md': 'u3',
  'docs/u4.md': 'u4',
  'docs/order-a.md': 'a',
  'docs/order-b.md': 'b',
  'docs/order-c.md': 'c',
  // R-73 budget + F-29: four docs each over 32,000 chars are cut to 32,000 (+ a marker) and,
  // counted without the marker, fill the 128,000 budget to the character
  'docs/bud-1.md': '1'.repeat(32_001),
  'docs/bud-2.md': '2'.repeat(33_000),
  'docs/bud-3.md': '3'.repeat(40_000),
  'docs/bud-4.md': '4'.repeat(50_000),
  'docs/bud-5.md': 'BUDGET-FIVE-TEXT',
  'docs/bud-6.md': 'BUDGET-SIX-TEXT',
  'docs/shared-2a.md': 'SHARED-TWO-AGENT-TEXT',
  'src/config.ts': 'export {}',
};

d('L05 project context (Testcontainers pg)', () => {
  let pg: PgFixture;
  let app: FastifyInstance;
  let llm: MockLLMProvider;
  let git: MockGitClient;
  let workspaceId: string;
  let repoSeq = 0;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    llm = new MockLLMProvider('openai', { structured: REVIEW });
    app = await buildApp({
      config: loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv),
      db: pg.handle.db,
      overrides: {
        embedder: new MockEmbedder(),
        git: (git = new MockGitClient({ diff: DIFF, files: FILES, head: 'abc1234' })),
        llm: { openai: llm, openrouter: new MockLLMProvider('openai', { structured: INTENT }) },
      },
    });
    // the request workspace, as the routes resolve it
    const probe = await createAgent('probe');
    const [row] = await pg.handle.db.select().from(t.agents).where(eq(t.agents.id, probe.id));
    workspaceId = row!.workspaceId;
  });

  afterAll(async () => {
    await app?.close();
    await pg?.stop();
  });

  // ---------------------------------------------------------------- helpers

  async function createAgent(name: string, over: Record<string, unknown> = {}) {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: { name, provider: 'openai', model: 'gpt-4.1', system_prompt: `SYS-${name}`, repo_intel: false, ...over },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; version: number };
  }

  async function createSkill(name: string, body: string, enabled = true) {
    const res = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: { name, description: 'd', type: 'rubric', body, enabled },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as { id: string; version: number };
  }

  const putAgentDocs = (id: string, docs: { path: string; enabled: boolean }[]) =>
    app.inject({ method: 'PUT', url: `/agents/${id}/context-docs`, payload: { docs } });
  const putSkillDocs = (id: string, docs: { path: string; enabled: boolean }[]) =>
    app.inject({ method: 'PUT', url: `/skills/${id}/context-docs`, payload: { docs } });
  const getAgentDocs = async (id: string) =>
    (await app.inject({ method: 'GET', url: `/agents/${id}/context-docs` })).json() as {
      attached: { path: string; order: number; enabled: boolean }[];
      inherited: { path: string; skill_id: string; skill_name: string }[];
    };

  async function linkSkills(agentId: string, skills: { skill_id: string; enabled: boolean }[]) {
    const res = await app.inject({ method: 'POST', url: `/agents/${agentId}/skills`, payload: { skills } });
    expect(res.statusCode).toBe(200);
  }

  async function makeRepo(cloned = true) {
    const name = `ctx-api-${repoSeq++}`;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({
        workspaceId,
        owner: 'acme',
        name,
        fullName: `acme/${name}`,
        clonePath: cloned ? `/mock/clones/acme/${name}` : null,
      })
      .returning();
    return repo!;
  }

  async function makePr(repoId: string) {
    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number: 900 + repoSeq,
        title: 'Add key',
        author: 'marisa.koch',
        branch: 'feat/k',
        base: 'main',
        headSha: 'a1b2c3d4',
        additions: 1,
        deletions: 0,
        filesCount: 1,
        status: 'needs_review',
      })
      .returning();
    await pg.handle.db.insert(t.prFiles).values({
      prId: pr!.id,
      path: 'src/config.ts',
      additions: 1,
      deletions: 0,
      patch: '@@ -10,3 +10,4 @@\n   port: 3000,\n+  stripeKey: "sk_live_xxx",\n   redisUrl: x,',
    });
    return pr!;
  }

  /** Run one agent on a fresh PR; return the run row, the Review user message and the trace. */
  async function runAgent(agentId: string, opts: { cloned?: boolean } = {}) {
    const repo = await makeRepo(opts.cloned ?? true);
    const pr = await makePr(repo.id);
    const before = llm.calls.length;
    const res = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId } });
    expect(res.statusCode).toBe(200);
    const runId = res.json().runs[0].run_id as string;
    const runs = await waitForPrRuns(pg.handle.db, pr.id, { expected: 1, timeoutMs: 20_000 });
    const reviewCalls = llm.calls
      .slice(before)
      .filter((c) => c.method === 'completeStructured')
      .map((c) => c.req as { schemaName: string; messages: { role: string; content: string }[] })
      .filter((r) => r.schemaName === 'Review');
    expect(reviewCalls).toHaveLength(1);
    const user = reviewCalls[0]!.messages.find((m) => m.role === 'user')!.content;
    // The executor marks the run `done` BEFORE it writes run_traces
    // (run-executor.ts: status update, then saveRunTrace), so a terminal status
    // does not yet mean the trace exists. Poll for it.
    let trace: Record<string, unknown> | undefined;
    for (const start = Date.now(); Date.now() - start < 10_000; ) {
      const res = await app.inject({ method: 'GET', url: `/runs/${runId}/trace` });
      if (res.statusCode === 200 && res.json().specs_read !== undefined) {
        trace = res.json();
        break;
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(trace, 'run trace persisted').toBeDefined();
    return { run: runs.find((r) => r.id === runId)!, user, trace: trace as Record<string, any>, repo };
  }

  async function usageOf(path: string): Promise<number> {
    const repo = await makeRepo(true);
    const res = await app.inject({ method: 'GET', url: `/repos/${repo.id}/context-docs` });
    expect(res.statusCode).toBe(200);
    const doc = (res.json().docs as { path: string; used_by: number }[]).find((x) => x.path === path);
    expect(doc, `${path} is in the listing`).toBeDefined();
    return doc!.used_by;
  }

  /** An agent in a workspace the request context is NOT in. */
  async function foreignAgentAndSkill() {
    const [ws] = await pg.handle.db.insert(t.workspaces).values({ name: 'other' }).returning();
    const [agent] = await pg.handle.db
      .insert(t.agents)
      .values({ workspaceId: ws!.id, name: 'foreign', provider: 'openai', model: 'gpt-4.1', systemPrompt: 'x' })
      .returning();
    const [skill] = await pg.handle.db
      .insert(t.skills)
      .values({ workspaceId: ws!.id, name: 'foreign-skill', description: 'd', type: 'rubric', source: 'manual', body: 'b' })
      .returning();
    return { agent: agent!, skill: skill! };
  }

  // ----------------------------------------------------------------- routes

  it('agent links: survive a reload in order, a parked row keeps its place, version untouched', async () => {
    const agent = await createAgent('links');
    const docs = [
      { path: 'docs/order-b.md', enabled: true },
      { path: 'docs/order-a.md', enabled: false },
      { path: 'docs/order-c.md', enabled: true },
    ];
    const put = await putAgentDocs(agent.id, docs);
    expect(put.statusCode).toBe(200);

    expect((await getAgentDocs(agent.id)).attached).toEqual([
      { path: 'docs/order-b.md', order: 0, enabled: true },
      { path: 'docs/order-a.md', order: 1, enabled: false },
      { path: 'docs/order-c.md', order: 2, enabled: true },
    ]);

    // reorder + re-check
    await putAgentDocs(agent.id, [docs[2]!, { path: 'docs/order-a.md', enabled: true }, docs[0]!]);
    expect((await getAgentDocs(agent.id)).attached.map((l) => [l.path, l.enabled])).toEqual([
      ['docs/order-c.md', true],
      ['docs/order-a.md', true],
      ['docs/order-b.md', true],
    ]);

    const fresh = (await app.inject({ method: 'GET', url: `/agents/${agent.id}` })).json();
    expect(fresh.version).toBe(agent.version);
  });

  it('skill links: persist in order, parked row kept, skills.version and skill_versions untouched', async () => {
    const skill = await createSkill('ctx-skill-links', 'body');
    const put = await putSkillDocs(skill.id, [
      { path: 'docs/order-c.md', enabled: true },
      { path: 'docs/order-a.md', enabled: false },
    ]);
    expect(put.statusCode).toBe(200);
    const got = (await app.inject({ method: 'GET', url: `/skills/${skill.id}/context-docs` })).json();
    expect(got.attached).toEqual([
      { path: 'docs/order-c.md', order: 0, enabled: true },
      { path: 'docs/order-a.md', order: 1, enabled: false },
    ]);
    const fresh = (await app.inject({ method: 'GET', url: `/skills/${skill.id}` })).json();
    expect(fresh.version).toBe(skill.version);
    const versions = await pg.handle.db.select().from(t.skillVersions).where(eq(t.skillVersions.skillId, skill.id));
    expect(versions).toHaveLength(1);
  });

  it.each([
    ['a duplicate path', [{ path: 'docs/a.md', enabled: true }, { path: 'docs/a.md', enabled: false }]],
    ['a parent-dir path', [{ path: '../x.md', enabled: true }]],
    ['a non-markdown path', [{ path: 'x.txt', enabled: true }]],
    ['an excluded dir', [{ path: 'node_modules/a.md', enabled: true }]],
  ])('PUT with %s is 422 for agents and skills, and writes nothing', async (_name, docs) => {
    const agent = await createAgent('bad-put');
    const skill = await createSkill(`bad-put-${repoSeq++}`, 'b');
    const a = await putAgentDocs(agent.id, docs);
    const s = await putSkillDocs(skill.id, docs);
    expect(a.statusCode).toBe(422);
    expect(s.statusCode).toBe(422);
    expect((await getAgentDocs(agent.id)).attached).toEqual([]);
  });

  it('an agent or skill from another workspace is 404 on GET and PUT, and is not written', async () => {
    const { agent, skill } = await foreignAgentAndSkill();
    const body = [{ path: 'docs/u1.md', enabled: true }];
    expect((await app.inject({ method: 'GET', url: `/agents/${agent.id}/context-docs` })).statusCode).toBe(404);
    expect((await putAgentDocs(agent.id, body)).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/skills/${skill.id}/context-docs` })).statusCode).toBe(404);
    expect((await putSkillDocs(skill.id, body)).statusCode).toBe(404);
    expect(
      await pg.handle.db.select().from(t.agentContextDocs).where(eq(t.agentContextDocs.agentId, agent.id)),
    ).toEqual([]);
  });

  it('content endpoint: a bad path is 4xx (R-16), a doc at HEAD is served, a foreign repo is 404', async () => {
    const repo = await makeRepo(true);
    for (const path of ['../x.md', 'x.txt', 'node_modules/a.md']) {
      const res = await app.inject({
        method: 'GET',
        url: `/repos/${repo.id}/context-docs/content?path=${encodeURIComponent(path)}`,
      });
      expect(res.statusCode, path).toBe(422);
    }
    const missing = await app.inject({
      method: 'GET',
      url: `/repos/${repo.id}/context-docs/content?path=${encodeURIComponent('docs/nope.md')}`,
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('context_doc_not_found');
    const ok = await app.inject({
      method: 'GET',
      url: `/repos/${repo.id}/context-docs/content?path=${encodeURIComponent('docs/agent-a.md')}`,
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ path: 'docs/agent-a.md', sha: 'abc1234', content: 'AGENT-A-TEXT' });

    const [ws] = await pg.handle.db.insert(t.workspaces).values({ name: 'other-repo-ws' }).returning();
    const [foreign] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId: ws!.id, owner: 'x', name: 'y', fullName: 'x/y', clonePath: '/mock/x/y' })
      .returning();
    expect((await app.inject({ method: 'GET', url: `/repos/${foreign!.id}/context-docs` })).statusCode).toBe(404);
  });

  it('"Used by N" (D-OQ2): direct + via active skill, each agent once; disabled agent counts; parked row and off/unchecked skill do not', async () => {
    // u1: agent A has it directly AND through an active skill → counts once.
    //     agent B (disabled) has it directly → counts.
    const a = await createAgent('usage-a');
    const b = await createAgent('usage-b', { enabled: false });
    const sOn = await createSkill('usage-on', 'b');
    await putSkillDocs(sOn.id, [{ path: 'docs/u1.md', enabled: true }]);
    await linkSkills(a.id, [{ skill_id: sOn.id, enabled: true }]);
    await putAgentDocs(a.id, [{ path: 'docs/u1.md', enabled: true }]);
    await putAgentDocs(b.id, [{ path: 'docs/u1.md', enabled: true }]);
    expect(await usageOf('docs/u1.md')).toBe(2);

    // u2: only through a globally disabled skill → 0.
    const c = await createAgent('usage-c');
    const sOff = await createSkill('usage-off', 'b', false);
    await putSkillDocs(sOff.id, [{ path: 'docs/u2.md', enabled: true }]);
    await linkSkills(c.id, [{ skill_id: sOff.id, enabled: true }]);
    expect(await usageOf('docs/u2.md')).toBe(0);

    // u3: only through a skill unchecked on the agent → 0.
    const e = await createAgent('usage-e');
    const sParked = await createSkill('usage-parked', 'b');
    await putSkillDocs(sParked.id, [{ path: 'docs/u3.md', enabled: true }]);
    await linkSkills(e.id, [{ skill_id: sParked.id, enabled: false }]);
    expect(await usageOf('docs/u3.md')).toBe(0);

    // u4: a parked (unchecked) direct row → 0; checking it → 1.
    const f = await createAgent('usage-f');
    await putAgentDocs(f.id, [{ path: 'docs/u4.md', enabled: false }]);
    expect(await usageOf('docs/u4.md')).toBe(0);
    await putAgentDocs(f.id, [{ path: 'docs/u4.md', enabled: true }]);
    expect(await usageOf('docs/u4.md')).toBe(1);
  });

  // ------------------------------------------------------------ review runs

  it('a run puts agent docs first, then skill docs, deduped; trace, skip, truncation and log follow', async () => {
    const agent = await createAgent('runner');
    const skill = await createSkill('run-skill', 'RUN-SKILL-BODY');
    await putSkillDocs(skill.id, [
      { path: 'docs/skill-x.md', enabled: true },
      { path: 'docs/agent-a.md', enabled: true }, // duplicate of the agent's own → once, as the agent's
    ]);
    await linkSkills(agent.id, [{ skill_id: skill.id, enabled: true }]);
    await putAgentDocs(agent.id, [
      { path: 'docs/agent-a.md', enabled: true },
      { path: 'docs/u2.md', enabled: false }, // parked → not in the prompt
      { path: 'docs/missing.md', enabled: true }, // not in the tree
      { path: 'docs/big.md', enabled: true },
    ]);

    const { run, user, trace } = await runAgent(agent.id);
    expect(run.status).toBe('done');

    // one section, documents in R-46 order, each once
    expect(user.match(/## Project context/g)).toHaveLength(1);
    const sources = [...user.matchAll(/<untrusted source="(docs\/[^"]+)">/g)].map((m) => m[1]);
    expect(sources).toEqual(['docs/agent-a.md', 'docs/big.md', 'docs/skill-x.md']);
    expect(user.match(/AGENT-A-TEXT/g)).toHaveLength(1);
    expect(user).not.toContain('<untrusted source="docs/u2.md">');
    // the big doc is cut with a visible marker
    expect(user).toContain('[truncated: first 32,000 of 40,000 characters]');
    expect(user).not.toContain('B'.repeat(32_001));

    expect(trace.specs_read).toEqual(['docs/agent-a.md', 'docs/big.md', 'docs/skill-x.md']);
    expect(trace.specs_skipped).toEqual([{ path: 'docs/missing.md', reason: 'not_found' }]);
    expect(trace.specs_truncated).toEqual(['docs/big.md']);

    const msgs = (trace.log as { msg: string }[]).map((l) => l.msg);
    const docLines = msgs.filter((m) => m.startsWith('context doc: '));
    expect(docLines).toEqual([
      'context doc: docs/agent-a.md (12 chars) → prompt',
      'context doc: docs/big.md (40000 chars, truncated to 32000) → prompt',
      'context doc: docs/skill-x.md (12 chars) → prompt',
    ]);
    expect(msgs).toContain('context doc skipped: docs/missing.md — not_found');
  });

  it('R-73 budget (F-29: four truncated docs fit): earlier docs kept, the first misfit and every later doc skipped as budget in prompt order; run completes', async () => {
    const agent = await createAgent('budget');
    const skill = await createSkill('budget-skill', 'BUDGET-SKILL-BODY');
    await putSkillDocs(skill.id, [{ path: 'docs/bud-6.md', enabled: true }]);
    await linkSkills(agent.id, [{ skill_id: skill.id, enabled: true }]);
    await putAgentDocs(agent.id, [
      { path: 'docs/bud-1.md', enabled: true },
      { path: 'docs/bud-2.md', enabled: true },
      { path: 'docs/bud-3.md', enabled: true },
      { path: 'docs/bud-4.md', enabled: true },
      { path: 'docs/bud-5.md', enabled: true }, // 4 × 32,000 + 16 > budget → first misfit (the fifth doc)
      { path: 'docs/missing.md', enabled: true }, // not_found, sits between two budget skips
    ]);

    const { run, user, trace } = await runAgent(agent.id);
    expect(run.status).toBe('done');
    const sources = [...user.matchAll(/<untrusted source="(docs\/[^"]+)">/g)].map((m) => m[1]);
    expect(sources).toEqual(['docs/bud-1.md', 'docs/bud-2.md', 'docs/bud-3.md', 'docs/bud-4.md']);
    for (const n of ['1', '2', '3', '4']) {
      expect(user).toContain(n.repeat(32_000));
      expect(user).not.toContain(n.repeat(32_001)); // cut at the R-52 limit
    }
    expect(user.match(/\[truncated: first 32,000 of [\d,]+ characters\]/g)).toEqual([
      '[truncated: first 32,000 of 32,001 characters]',
      '[truncated: first 32,000 of 33,000 characters]',
      '[truncated: first 32,000 of 40,000 characters]',
      '[truncated: first 32,000 of 50,000 characters]',
    ]);
    expect(user).not.toContain('BUDGET-FIVE-TEXT');
    expect(user).not.toContain('BUDGET-SIX-TEXT');
    expect(user).toContain('BUDGET-SKILL-BODY'); // the skill body is not cut by the doc budget

    expect(trace.specs_read).toEqual(['docs/bud-1.md', 'docs/bud-2.md', 'docs/bud-3.md', 'docs/bud-4.md']);
    // F-29: the markers do not count, so none of the four truncated docs is a budget skip
    expect(trace.specs_truncated).toEqual(['docs/bud-1.md', 'docs/bud-2.md', 'docs/bud-3.md', 'docs/bud-4.md']);
    expect(trace.specs_skipped).toEqual([
      { path: 'docs/bud-5.md', reason: 'budget' },
      { path: 'docs/missing.md', reason: 'not_found' },
      { path: 'docs/bud-6.md', reason: 'budget' },
    ]);
    const msgs = (trace.log as { msg: string }[]).map((l) => l.msg);
    expect(msgs).toContain('context doc skipped: docs/bud-5.md — budget');
    expect(msgs).toContain('context doc skipped: docs/bud-6.md — budget');
  });

  it('two agents of one run on one PR read a shared blob from git once', async () => {
    const a = await createAgent('two-a');
    const b = await createAgent('two-b');
    await putAgentDocs(a.id, [{ path: 'docs/shared-2a.md', enabled: true }]);
    await putAgentDocs(b.id, [{ path: 'docs/shared-2a.md', enabled: true }]);
    const repo = await makeRepo(true);
    const pr = await makePr(repo.id);
    const readFileAt = vi.spyOn(git, 'readFileAt');
    try {
      const before = llm.calls.length;
      const [ra, rb] = await Promise.all([
        app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: a.id } }),
        app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: b.id } }),
      ]);
      expect(ra.statusCode).toBe(200);
      expect(rb.statusCode).toBe(200);
      const runs = await waitForPrRuns(pg.handle.db, pr.id, { expected: 2, timeoutMs: 20_000 });
      expect(runs.map((r) => r.status)).toEqual(['done', 'done']);
      const users = llm.calls
        .slice(before)
        .filter((c) => c.method === 'completeStructured')
        .map((c) => c.req as { schemaName: string; messages: { role: string; content: string }[] })
        .filter((r) => r.schemaName === 'Review')
        .map((r) => r.messages.find((m) => m.role === 'user')!.content);
      expect(users).toHaveLength(2);
      for (const u of users) expect(u).toContain('SHARED-TWO-AGENT-TEXT');
      const sharedReads = readFileAt.mock.calls.filter((c) => c[2] === 'docs/shared-2a.md');
      expect(sharedReads).toHaveLength(1);
    } finally {
      readFileAt.mockRestore();
    }
  });

  it('the six context-docs routes answer in their contract shape, with no extra keys (F-17)', async () => {
    const agent = await createAgent('shape');
    const skill = await createSkill('shape-skill', 'b');
    await linkSkills(agent.id, [{ skill_id: skill.id, enabled: true }]);
    const repo = await makeRepo(true);

    const exact = (schema: { parse(v: unknown): unknown }, body: unknown) => {
      expect(schema.parse(body)).toEqual(body);
    };

    const putSkill = await putSkillDocs(skill.id, [{ path: 'docs/skill-x.md', enabled: true }]);
    expect(putSkill.statusCode).toBe(200);
    exact(SkillContextDocs, putSkill.json());
    expect(putSkill.json().attached).toHaveLength(1);

    const getSkill = await app.inject({ method: 'GET', url: `/skills/${skill.id}/context-docs` });
    expect(getSkill.statusCode).toBe(200);
    exact(SkillContextDocs, getSkill.json());

    const putAgent = await putAgentDocs(agent.id, [{ path: 'docs/agent-a.md', enabled: false }]);
    expect(putAgent.statusCode).toBe(200);
    exact(AgentContextDocs, putAgent.json());

    const getAgent = await app.inject({ method: 'GET', url: `/agents/${agent.id}/context-docs` });
    expect(getAgent.statusCode).toBe(200);
    exact(AgentContextDocs, getAgent.json());
    expect(getAgent.json().attached).toHaveLength(1);
    expect(getAgent.json().inherited).toHaveLength(1);

    const list = await app.inject({ method: 'GET', url: `/repos/${repo.id}/context-docs` });
    expect(list.statusCode).toBe(200);
    exact(ContextDocList, list.json());
    expect(list.json().docs.length).toBeGreaterThan(0);

    const content = await app.inject({
      method: 'GET',
      url: `/repos/${repo.id}/context-docs/content?path=${encodeURIComponent('docs/skill-x.md')}`,
    });
    expect(content.statusCode).toBe(200);
    exact(ContextDocContent, content.json());
    expect(content.json()).toEqual({ path: 'docs/skill-x.md', sha: 'abc1234', content: 'SKILL-X-TEXT', chars: 12 });
  });

  it('an uncloned repo skips every doc as not_cloned and the run still completes', async () => {
    const agent = await createAgent('uncloned');
    await putAgentDocs(agent.id, [{ path: 'docs/agent-a.md', enabled: true }]);
    const { run, user, trace } = await runAgent(agent.id, { cloned: false });
    expect(run.status).toBe('done');
    expect(user).not.toContain('## Project context');
    expect(trace.specs_read).toEqual([]);
    expect(trace.specs_skipped).toEqual([{ path: 'docs/agent-a.md', reason: 'not_cloned' }]);
    expect((trace.log as { msg: string }[]).map((l) => l.msg)).toContain(
      'context doc skipped: docs/agent-a.md — not_cloned',
    );
  });

  it('no attachments → no ## Project context, no rule line, no skip/truncation fields (R-49)', async () => {
    const agent = await createAgent('bare');
    const { run, user, trace } = await runAgent(agent.id);
    expect(run.status).toBe('done');
    expect(user).not.toContain('## Project context');
    expect(user).not.toContain("project's own documents");
    expect(trace.specs_read).toEqual([]);
    expect(trace).not.toHaveProperty('specs_skipped');
    expect(trace).not.toHaveProperty('specs_truncated');
  });

  it('ONE gate: inherited rows, the prompt (skill body + docs) and "Used by N" agree for active / off / unchecked skills', async () => {
    const agent = await createAgent('gate');
    const active = await createSkill('gate-active', 'GATE-ACTIVE-BODY');
    const off = await createSkill('gate-off', 'GATE-OFF-BODY', false);
    const unchecked = await createSkill('gate-unchecked', 'GATE-UNCHECKED-BODY');
    await putSkillDocs(active.id, [{ path: 'docs/active.md', enabled: true }]);
    await putSkillDocs(off.id, [{ path: 'docs/off.md', enabled: true }]);
    await putSkillDocs(unchecked.id, [{ path: 'docs/unchecked.md', enabled: true }]);
    await linkSkills(agent.id, [
      { skill_id: active.id, enabled: true },
      { skill_id: off.id, enabled: true },
      { skill_id: unchecked.id, enabled: false },
    ]);

    // 1. the Context tab's inherited rows
    expect((await getAgentDocs(agent.id)).inherited).toEqual([
      { path: 'docs/active.md', skill_id: active.id, skill_name: 'gate-active' },
    ]);

    // 2. the prompt: body and doc of the active skill only
    const { user, trace } = await runAgent(agent.id);
    expect(user).toContain('GATE-ACTIVE-BODY');
    expect(user).toContain('<untrusted source="docs/active.md">\nACTIVE-SKILL-DOC-TEXT');
    for (const absent of ['GATE-OFF-BODY', 'GATE-UNCHECKED-BODY', 'OFF-SKILL-DOC-TEXT', 'UNCHECKED-SKILL-DOC-TEXT']) {
      expect(user).not.toContain(absent);
    }
    expect(trace.specs_read).toEqual(['docs/active.md']);

    // 3. "Used by N"
    expect(await usageOf('docs/active.md')).toBe(1);
    expect(await usageOf('docs/off.md')).toBe(0);
    expect(await usageOf('docs/unchecked.md')).toBe(0);

    // flipping the gates moves all three together
    await app.inject({ method: 'PUT', url: `/skills/${off.id}`, payload: { enabled: true } });
    await linkSkills(agent.id, [
      { skill_id: active.id, enabled: false },
      { skill_id: off.id, enabled: true },
      { skill_id: unchecked.id, enabled: true },
    ]);
    expect((await getAgentDocs(agent.id)).inherited.map((r) => r.path)).toEqual(['docs/off.md', 'docs/unchecked.md']);
    const second = await runAgent(agent.id);
    expect(second.user).toContain('GATE-OFF-BODY');
    expect(second.user).toContain('GATE-UNCHECKED-BODY');
    expect(second.user).not.toContain('GATE-ACTIVE-BODY');
    expect(second.trace.specs_read).toEqual(['docs/off.md', 'docs/unchecked.md']);
    expect(await usageOf('docs/active.md')).toBe(0);
    expect(await usageOf('docs/off.md')).toBe(1);
    expect(await usageOf('docs/unchecked.md')).toBe(1);
  });
});
