/**
 * L05 PR Brief — `GET /pulls/:id/brief` and `POST /pulls/:id/brief/generate`
 * end to end over the built app and a real Postgres (plan step 24).
 *
 * The real `container.jobs` runs the generation; models are recording mocks
 * injected through `ContainerOverrides.llm`; GitHub is `MockGitHubClient`;
 * repo-intel is a fake facade (as `blast-route.it.test.ts`); secrets come from
 * an in-memory provider, so the developer's real `~/.devdigest/secrets.json`
 * never leaks into a "no key" case.
 *
 * Expected values come from the requirements (R-IDs per `it`) and the plan's
 * decisions, not from the implementation.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { PrBrief, type SecretKey, type SecretsProvider, type StructuredRequest } from '@devdigest/shared';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitHubClient, MockLLMProvider } from '../src/adapters/mocks.js';
import type { ContainerOverrides } from '../src/platform/container.js';
import type { BlastFacadeResult } from '../src/modules/blast/types.js';
import { GatedLLM } from './helpers/onboarding-llm.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;
if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[brief] Docker not available — skipping integration tests.');
}

class MemorySecrets implements SecretsProvider {
  values = new Map<string, string>();
  async get(key: SecretKey) {
    return this.values.get(key as string);
  }
  async set(key: SecretKey, value: string) {
    this.values.set(key as string, value);
  }
}

const TITLE = 'Add rate limiting to the public API';
const ANSWER = {
  summary: 'Adds a limiter to the public API.',
  risks: [{ kind: 'security', title: 'Limiter bypass', explanation: 'e', severity: 'high', file_refs: ['src/limiter.ts:2-4', 'invented.ts'] }],
  review_focus: [
    { file: 'src/limiter.ts', line: 3, reason: 'the limit' },
    { file: 'src/server.ts', line: 41, reason: 'the caller' },
  ],
};
const BAD_ANSWER = { ...ANSWER, review_focus: [{ file: 'src/limiter.ts', line: 0, reason: 'x' }] };

const FACADE: BlastFacadeResult = {
  changedSymbols: [{ file: 'src/limiter.ts', name: 'limit', kind: 'function' }],
  callers: [{ file: 'src/server.ts', symbol: 'handler', viaSymbol: 'limit', line: 40, rank: 0.5 }],
  impactedEndpoints: [],
  factsByFile: {},
  degraded: false,
};

function fakeRepoIntel() {
  return {
    async getBlastRadius() {
      return FACADE;
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

const config = (env: Record<string, string> = {}) =>
  loadConfig({ ...process.env, NODE_ENV: 'test', ...env } as NodeJS.ProcessEnv);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const structured = (llm: { calls: { method: string; req: unknown }[] }) => llm.calls.filter((c) => c.method === 'completeStructured');
const reqOf = (llm: { calls: { method: string; req: unknown }[] }, i = -1) => structured(llm).at(i)!.req as StructuredRequest<unknown>;

d('/pulls/:id/brief (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let repoId: string;
  const apps: FastifyInstance[] = [];

  const mk = async (overrides: ContainerOverrides, env: Record<string, string> = {}) => {
    const app = await buildApp({
      config: config(env),
      db: pg.handle.db,
      overrides: { github: new MockGitHubClient(), secrets: new MemorySecrets(), repoIntel: fakeRepoIntel(), ...overrides },
    });
    apps.push(app);
    return app;
  };

  let nextNumber = 100;
  async function makePr(opts: { ws?: string; repo?: string; headSha?: string } = {}) {
    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId: opts.ws ?? workspaceId,
        repoId: opts.repo ?? repoId,
        number: nextNumber++,
        title: TITLE,
        body: 'Adds a token-bucket limiter. Closes #12.',
        author: 'dev',
        branch: 'feat/limit',
        base: 'main',
        headSha: opts.headSha ?? 'head-1',
        status: 'open',
      })
      .returning();
    const prId = pr!.id;
    await pg.handle.db.insert(t.prFiles).values([
      { prId, path: 'src/limiter.ts', additions: 3, deletions: 0, patch: '@@ -1,2 +1,5 @@\n import x\n+a\n+b\n+c\n export y' },
      { prId, path: 'src/routes/public.ts', additions: 1, deletions: 1, patch: '@@ -10,2 +10,2 @@\n-old\n+new\n ctx' },
    ]);
    return prId;
  }

  const getBrief = async (app: FastifyInstance, prId: string) => {
    const res = await app.inject({ method: 'GET', url: `/pulls/${prId}/brief` });
    return { status: res.statusCode, body: res.json() };
  };
  const post = (app: FastifyInstance, prId: string) => app.inject({ method: 'POST', url: `/pulls/${prId}/brief/generate` });
  const settle = async (app: FastifyInstance, prId: string) => {
    for (let i = 0; i < 200; i += 1) {
      const { body } = await getBrief(app, prId);
      if (!body.generating) return body;
      await sleep(25);
    }
    throw new Error('generation did not settle');
  };
  const row = async (prId: string) => {
    const [r] = await pg.handle.db.select().from(t.prBrief).where(eq(t.prBrief.prId, prId));
    return r;
  };

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: 'brief-api', fullName: 'acme/brief-api' })
      .returning();
    repoId = repo!.id;
  });

  afterAll(async () => {
    for (const a of apps) await a.close();
    await pg?.stop();
  });

  // -------------------------------------------------------------------------

  describe('generate and read (one app, mock OpenAI)', () => {
    let app: FastifyInstance;
    let llm: MockLLMProvider;
    let prId: string;

    beforeAll(async () => {
      llm = new MockLLMProvider('openai', { structured: ANSWER });
      app = await mk({ llm: { openai: llm } });
      prId = await makePr();
    });

    it('R-02, R-43, R-68 — no row yet: brief null, not generating, key flag, the default "Risk Brief" model', async () => {
      const { status, body } = await getBrief(app, prId);
      expect(status).toBe(200);
      expect(body).toEqual({
        brief: null,
        stale: false,
        current_head_sha: 'head-1',
        generating: false,
        last_failure: null,
        key_available: true,
        feature_model: { provider: 'openai', model: 'gpt-4.1' },
      });
      expect(structured(llm)).toHaveLength(0);
    });

    it('R-74, R-16, R-41, R-09 — 202 at once; the stored row parses as PrBrief with the PR\'s head SHA; one call', async () => {
      const res = await post(app, prId);
      expect(res.statusCode).toBe(202);
      expect(res.json()).toEqual({ generating: true });
      const view = await settle(app, prId);
      expect(view.last_failure).toBeNull();

      const r = await row(prId);
      const parsed = PrBrief.parse(r!.json);
      expect(parsed.meta.head_sha).toBe('head-1');
      expect(parsed.meta).toMatchObject({ provider: 'openai', model: 'gpt-4.1', tokens_in: 100, tokens_out: 50, cost_usd: 0.001 });
      expect(parsed.history).toBeNull();
      expect(parsed.risks.risks[0]!.file_refs).toEqual(['src/limiter.ts:2-4']);
      expect(parsed.meta.dropped).toEqual({ risks: 0, risk_refs: 1, review_focus: 0 });
      expect(parsed.review_focus).toEqual([
        { file: 'src/limiter.ts', line: 3, reason: 'the limit' },
        { file: 'src/server.ts', line: 40, reason: 'the caller' },
      ]);
      expect(view.brief).toEqual(parsed);

      expect(structured(llm)).toHaveLength(1);
      const user = reqOf(llm).messages[1]!.content;
      expect(user).toContain(`<untrusted source="pr-title">\n${TITLE}\n</untrusted>`);
      expect(user).toContain('src/limiter.ts | core | +3 -0 | lines: 2-4');
      expect(user).not.toContain('@@');
      expect(user).toContain('<untrusted source="linked-issue #12">\nIssue #12');
    });

    it('R-23, R-27 — the trim record and the missing inputs are persisted and served', async () => {
      const r = await row(prId);
      const meta = PrBrief.parse(r!.json).meta;
      expect(meta.trim).toMatchObject({ description: 'kept', callers_removed: 0, issue_body: 'kept', diff_rows_removed: 0, focus_lines_moved: 1 });
      expect(meta.trim.input_tokens).toBeGreaterThan(0);
      expect(meta.trim.input_tokens).toBeLessThanOrEqual(8000);
      // no pr_intent row exists for this PR
      expect(meta.missing_inputs).toContainEqual({ input: 'intent', reason: 'not_derived' });
      expect(meta.missing_inputs.map((m) => m.input)).not.toContain('diff_stats');
      expect(meta.missing_inputs.map((m) => m.input)).not.toContain('issue');
      const { body } = await getBrief(app, prId);
      expect(body.brief.meta.missing_inputs).toEqual(meta.missing_inputs);
    });

    it('R-03 — GET again: the same brief, no model call', async () => {
      const before = structured(llm).length;
      const a = await getBrief(app, prId);
      const b = await getBrief(app, prId);
      expect(b.body.brief).toEqual(a.body.brief);
      expect(structured(llm)).toHaveLength(before);
    });

    it('R-45, R-47 — a new head SHA in pull_requests → stale; nothing regenerates, the row is untouched', async () => {
      const before = structured(llm).length;
      const json = (await row(prId))!.json;
      await pg.handle.db.update(t.pullRequests).set({ headSha: 'head-2' }).where(eq(t.pullRequests.id, prId));
      const { body } = await getBrief(app, prId);
      expect(body.stale).toBe(true);
      expect(body.current_head_sha).toBe('head-2');
      expect(body.brief.meta.head_sha).toBe('head-1');
      await sleep(100);
      expect(structured(llm)).toHaveLength(before);
      expect((await row(prId))!.json).toEqual(json);
      const rows = await pg.handle.db.select().from(t.prBrief).where(eq(t.prBrief.prId, prId));
      expect(rows).toHaveLength(1);
    });

    it('R-44 — garbage json in pr_brief reads as no brief', async () => {
      const other = await makePr();
      await pg.handle.db.insert(t.prBrief).values({ prId: other, json: { intent: null, blast: null, risks: { risks: [] }, history: null } });
      expect((await getBrief(app, other)).body.brief).toBeNull();
      await pg.handle.db.update(t.prBrief).set({ json: 'not even an object' }).where(eq(t.prBrief.prId, other));
      expect((await getBrief(app, other)).body.brief).toBeNull();
    });

    it('R-18 — a PR of another workspace (and an unknown id) → 404 on GET and POST', async () => {
      const [other] = await pg.handle.db.insert(t.workspaces).values({ name: `other-${randomUUID().slice(0, 8)}` }).returning();
      const [otherRepo] = await pg.handle.db
        .insert(t.repos)
        .values({ workspaceId: other!.id, owner: 'acme', name: 'foreign', fullName: 'acme/foreign' })
        .returning();
      const foreign = await makePr({ ws: other!.id, repo: otherRepo!.id });
      const before = structured(llm).length;
      for (const id of [foreign, randomUUID()]) {
        const g = await getBrief(app, id);
        expect(g.status).toBe(404);
        expect(g.body.error.code).toBe('not_found');
        const p = await post(app, id);
        expect(p.statusCode).toBe(404);
      }
      expect(structured(llm)).toHaveLength(before);
      expect(await row(foreign)).toBeUndefined();
    });
  });

  describe('R-11, R-73 — the Settings choice for "Risk Brief"', () => {
    it('openrouter/x → the OpenRouter mock is called with model x and callLimits(\'x\')', async () => {
      const openai = new MockLLMProvider('openai', { structured: ANSWER });
      const openrouter = new MockLLMProvider('openai', { structured: ANSWER });
      const app = await mk({ llm: { openai, openrouter } });
      const prId = await makePr();
      const put = await app.inject({ method: 'PUT', url: '/settings', payload: { feature_models: { risk_brief: { provider: 'openrouter', model: 'x' } } } });
      expect(put.statusCode).toBe(200);
      try {
        expect((await getBrief(app, prId)).body.feature_model).toEqual({ provider: 'openrouter', model: 'x' });
        expect((await post(app, prId)).statusCode).toBe(202);
        await settle(app, prId);
        expect(structured(openai)).toHaveLength(0);
        expect(structured(openrouter)).toHaveLength(1);
        expect(reqOf(openrouter)).toMatchObject({ model: 'x', maxTokens: 2_000, timeoutMs: 60_000, maxRetries: 0 });
        expect(PrBrief.parse((await row(prId))!.json).meta).toMatchObject({ provider: 'openrouter', model: 'x' });
      } finally {
        await pg.handle.db.delete(t.settings).where(and(eq(t.settings.workspaceId, workspaceId), eq(t.settings.key, 'feature_models')));
      }
    });
  });

  describe('R-15 — one generation per PR at a time', () => {
    it('a second POST while one runs → 409 with the R-15 message, no second call', async () => {
      const gated = new GatedLLM(ANSWER);
      const app = await mk({ llm: { openai: gated } });
      const prId = await makePr();
      expect((await post(app, prId)).statusCode).toBe(202);
      expect((await getBrief(app, prId)).body.generating).toBe(true);
      const second = await post(app, prId);
      expect(second.statusCode).toBe(409);
      expect(second.json().error).toMatchObject({
        code: 'brief_generation_running',
        message: 'A brief is already being generated for this PR',
      });
      gated.release();
      const view = await settle(app, prId);
      expect(view.brief).not.toBeNull();
      expect(structured(gated)).toHaveLength(1);
    });
  });

  describe('R-39, R-68 — no key', () => {
    it('GET key_available false before any click; POST 409 brief_no_api_key with the exact text', async () => {
      const app = await mk({}); // MemorySecrets empty, no llm override
      const prId = await makePr();
      const g = await getBrief(app, prId);
      expect(g.body).toMatchObject({ key_available: false, feature_model: { provider: 'openai', model: 'gpt-4.1' }, generating: false });
      const p = await post(app, prId);
      expect(p.statusCode).toBe(409);
      expect(p.json().error).toMatchObject({
        code: 'brief_no_api_key',
        message: 'No API key for openai — add one in Settings → API Keys or pick another model for Risk Brief',
      });
      expect((await getBrief(app, prId)).body.generating).toBe(false);
      expect(await row(prId)).toBeUndefined();
    });
  });

  describe('R-38, R-61, R-75 — a failed regeneration', () => {
    it('invalid answer → last_failure invalid_output on GET; the old brief is kept', async () => {
      const prId = await makePr();
      const good = await mk({ llm: { openai: new MockLLMProvider('openai', { structured: ANSWER }) } });
      await post(good, prId);
      await settle(good, prId);
      const before = (await row(prId))!.json;

      const badLlm = new MockLLMProvider('openai', { structured: BAD_ANSWER });
      const bad = await mk({ llm: { openai: badLlm } });
      expect((await post(bad, prId)).statusCode).toBe(202);
      const view = await settle(bad, prId);
      expect(structured(badLlm)).toHaveLength(1);
      expect(view.last_failure).toMatchObject({ code: 'invalid_output', message: 'The model returned invalid output' });
      expect(view.brief).toEqual(PrBrief.parse(before));
      expect((await row(prId))!.json).toEqual(before);
    });
  });

  describe('R-66 — the PR-detail refresh persists head_sha', () => {
    it('GET /pulls/:id with GitHub reporting a new head → pull_requests.head_sha updated, brief turns stale', async () => {
      const prId = await makePr({ headSha: 'old-head' });
      const app = await mk({
        github: new MockGitHubClient({ detail: { head_sha: 'gh-new-head' } }),
        llm: { openai: new MockLLMProvider('openai', { structured: ANSWER }) },
      });
      await post(app, prId);
      await settle(app, prId);
      const res = await app.inject({ method: 'GET', url: `/pulls/${prId}` });
      expect(res.statusCode).toBe(200);
      const [pr] = await pg.handle.db.select().from(t.pullRequests).where(eq(t.pullRequests.id, prId));
      expect(pr!.headSha).toBe('gh-new-head');
      const { body } = await getBrief(app, prId);
      expect(body.stale).toBe(true);
      expect(body.current_head_sha).toBe('gh-new-head');
    });
  });

  describe('F-06 — POST generate has its own rate limit of 10 per minute', () => {
    it('the 11th POST within a minute → 429 (rate limiting is on outside NODE_ENV=test)', async () => {
      const app = await mk({ llm: { openai: new MockLLMProvider('openai', { structured: ANSWER }) } }, { NODE_ENV: 'production', LOG_LEVEL: 'silent' });
      const unknown = randomUUID();
      const codes: number[] = [];
      for (let i = 0; i < 11; i += 1) codes.push((await post(app, unknown)).statusCode);
      expect(codes.slice(0, 10)).toEqual(Array(10).fill(404));
      expect(codes[10]).toBe(429);
      // GET is not limited by that per-route budget
      expect((await getBrief(app, unknown)).status).toBe(404);
    });
  });
});
