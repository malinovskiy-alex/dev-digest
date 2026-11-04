/**
 * PR Brief (L05) — BriefService over fake ports (plan step 23e): recording
 * MockLLMProvider variants, a JobQueue stub that runs the handler on
 * `enqueue`, a capturing logger. No database: the module's only SQL file
 * (`repository.ts`) is replaced by an in-memory fake through `vi.mock`, the
 * same way `onboarding-service.test.ts` does it.
 *
 * Expected values come from the requirements, the plan's D-n and the review
 * resolutions F-04, F-12, F-17 — not from the implementation. F-11 is accepted
 * (adapter transport retries allowed), so nothing here asserts on them.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { wrapUntrusted } from '@devdigest/reviewer-core';
import type {
  BlastRadius,
  FeatureModelChoice,
  Intent,
  LLMProvider,
  PrBrief,
  StructuredRequest,
  StructuredResult,
} from '@devdigest/shared';
import { MockLLMProvider } from '../src/adapters/mocks.js';
import { AppError, ConfigError, NotFoundError } from '../src/platform/errors.js';
import { renderPrompt } from '../src/platform/prompts.js';
import { FailingLLM, GatedLLM } from './helpers/onboarding-llm.js';

// ---------------------------------------------------------------------------
// In-memory BriefRepository (the module's only SQL)
// ---------------------------------------------------------------------------

const store = vi.hoisted(() => ({
  rows: new Map<string, unknown>(),
  upserts: 0,
  failUpsert: null as Error | null,
}));

vi.mock('../src/modules/brief/repository.js', () => ({
  BriefRepository: class {
    async get(prId: string) {
      return store.rows.get(prId);
    }
    async upsert(prId: string, json: unknown) {
      if (store.failUpsert) throw store.failUpsert;
      store.upserts += 1;
      store.rows.set(prId, structuredClone(json));
    }
  },
}));

const { BriefService } = await import('../src/modules/brief/service.js');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WS = 'ws-1';
const PR = 'pr-1';
const TITLE = 'Add rate limiting to the public API';
const BODY = 'Adds a token-bucket limiter.\r\n\r\nCloses #12 and fixes #13.';
const REPO = { owner: 'acme', name: 'api', clonePath: '/clones/acme/api' as string | null };

const INTENT: Intent = {
  intent: 'Rate-limit the public API',
  in_scope: ['limiter'],
  out_of_scope: [],
  kind: 'feature',
  risk_areas: ['429s'],
  conflicts: [],
  confidence: 'high',
  sources: [],
  generated_at: null,
};

const FILES = [
  { path: 'test/limiter.test.ts', additions: 5, deletions: 0, patch: null },
  { path: 'src/routes/public.ts', additions: 1, deletions: 1, patch: '@@ -10,2 +10,2 @@\n-old\n+new\n ctx' },
  { path: 'src/limiter.ts', additions: 3, deletions: 0, patch: '@@ -1,2 +1,5 @@\n import x\n+a\n+b\n+c\n export y' },
];

function blast(over: Partial<BlastRadius> = {}): BlastRadius {
  return {
    changed_symbols: [{ name: 'limit', file: 'src/limiter.ts', kind: 'function' }],
    downstream: [
      {
        symbol: 'limit',
        callers: [{ name: 'handler', file: 'src/server.ts', line: 40, endpoints: [], crons: [] }],
        endpoints_affected: [],
        crons_affected: [],
      },
    ],
    summary: '1 changed symbol, 1 caller',
    counts: { symbols: 1, callers: 1, endpoints: 0, crons: 0 },
    degraded: false,
    reason: null,
    index_status: 'full',
    indexed_sha: 'idx',
    ...over,
  };
}

const ANSWER = {
  summary: 'Adds a limiter to the public API.',
  risks: [
    { kind: 'security', title: 'Limiter bypass', explanation: 'e', severity: 'high', file_refs: ['src/limiter.ts:2-4', 'src/ghost.ts'] },
    { kind: 'x', title: 'Invented', explanation: 'e', severity: 'low', file_refs: ['nope.ts'] },
  ],
  review_focus: [
    { file: 'src/limiter.ts', line: 3, reason: 'the limit itself' },
    { file: 'src/server.ts', line: 41, reason: 'the caller' },
    { file: 'ghost.ts', line: 1, reason: 'invented' },
  ],
};

const AGENTS = [{ id: 'ag1' }, { id: 'ag2' }];
const AGENT_DOCS: Record<string, string[]> = { ag1: ['specs/b.md'], ag2: ['specs/a.md', 'specs/b.md'] };
const SKILL_DOCS: Record<string, Array<{ skillName: string; paths: string[] }>> = {
  ag1: [{ skillName: 's', paths: ['docs/c.md'] }],
};

type RecordingLLM = LLMProvider & { calls: { method: string; req: unknown }[] };

class NoCostLLM extends MockLLMProvider {
  override async completeStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const r = await super.completeStructured(req);
    return { ...r, costUsd: null };
  }
}

class HangingLLM extends MockLLMProvider {
  override async completeStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    this.calls.push({ method: 'completeStructured', req });
    return new Promise<never>(() => {});
  }
}

/** Records every property read on a port; members it does not have throw (R-10). */
function strict<T extends object>(name: string, target: T, seen: string[]): T {
  return new Proxy(target, {
    get(t, prop, recv) {
      if (typeof prop === 'symbol' || prop === 'then') return Reflect.get(t, prop, recv);
      seen.push(`${name}.${prop}`);
      if (!(prop in t)) throw new Error(`unexpected port member ${name}.${String(prop)}`);
      return Reflect.get(t, prop, recv);
    },
  });
}

interface Setup {
  llm?: RecordingLLM;
  choice?: FeatureModelChoice;
  key?: boolean;
  llmDep?: () => Promise<LLMProvider>;
  noIntent?: boolean;
  files?: typeof FILES;
  body?: string | null;
  repo?: typeof REPO;
  blastFn?: () => Promise<BlastRadius>;
  github?: () => Promise<unknown>;
  getIssue?: (repo: unknown, n: number) => Promise<{ number: number; title: string; body?: string | null }>;
  agents?: Array<{ id: string }>;
  resolve?: (repo: unknown, refs: { agent: string[]; skills: unknown[] }) => Promise<{
    docs: Array<{ path: string; text: string; chars: number; truncated: boolean }>;
    skipped: Array<{ path: string; reason: string }>;
  }>;
  getIntent?: () => Promise<{ record: Intent } | undefined>;
  getPrFiles?: () => Promise<typeof FILES>;
  generationTimeoutMs?: number;
  /** Replace the job's `done`; the handler is then NOT called by enqueue. */
  jobDone?: () => Promise<void>;
}

function setup(o: Setup = {}) {
  const seen: string[] = [];
  const llm: RecordingLLM = o.llm ?? new MockLLMProvider('openai', { structured: ANSWER });
  const state = {
    pull: { id: PR, repoId: 'repo-1', number: 7, title: TITLE, headSha: 'head-1', body: o.body === undefined ? BODY : o.body },
    key: o.key ?? true,
    choice: o.choice ?? ({ provider: 'openai', model: 'gpt-4.1' } as FeatureModelChoice),
  };
  const pulls = strict(
    'pulls',
    {
      getPull: vi.fn(async (ws: string, id: string) => (ws === WS && id === PR ? { ...state.pull } : undefined)),
      getRepo: vi.fn(async () => o.repo ?? REPO),
      getPrFiles: vi.fn(o.getPrFiles ?? (async () => o.files ?? FILES)),
      getIntent: vi.fn(o.getIntent ?? (async () => (o.noIntent ? undefined : { record: INTENT }))),
    },
    seen,
  );
  const blastPort = strict('blast', { forResolvedPull: vi.fn(o.blastFn ?? (async () => blast())) }, seen);
  const agents = strict(
    'agents',
    {
      listEnabled: vi.fn(async () => o.agents ?? AGENTS),
      enabledContextDocPaths: vi.fn(async (id: string) => AGENT_DOCS[id] ?? []),
    },
    seen,
  );
  const skills = strict('skills', { promptContextDocsForAgent: vi.fn(async (id: string) => SKILL_DOCS[id] ?? []) }, seen);
  const projectContext = strict(
    'projectContext',
    {
      resolveForPrompt: vi.fn(
        o.resolve ??
          (async (_repo: unknown, refs: { agent: string[] }) => ({
            docs: refs.agent.map((p) => ({ path: p, text: `SPEC TEXT OF ${p}`, chars: 20, truncated: false })),
            skipped: [],
          })),
      ),
    },
    seen,
  );
  const getIssue = vi.fn(
    o.getIssue ?? (async (_r: unknown, n: number) => ({ number: n, title: 'Public API is abused', body: 'Bots hammer /search.' })),
  );
  const gh = strict('github', { getIssue }, seen);
  const github = vi.fn(o.github ?? (async () => gh));
  const featureModel = vi.fn(async () => state.choice);
  const hasLlmKey = vi.fn(async () => state.key);
  const llmDep = vi.fn(o.llmDep ?? (async () => llm));
  const logs: Array<{ level: 'info' | 'warn'; obj: Record<string, unknown>; msg?: string }> = [];
  const logger = {
    info: (obj: unknown, msg?: string) => logs.push({ level: 'info', obj: obj as Record<string, unknown>, msg }),
    warn: (obj: unknown, msg?: string) => logs.push({ level: 'warn', obj: obj as Record<string, unknown>, msg }),
  };
  const jobs = {
    handler: undefined as undefined | ((p: unknown) => Promise<void>),
    payloads: [] as unknown[],
    dones: [] as Promise<void>[],
    register: vi.fn(function (this: unknown, _kind: string, h: (p: unknown) => Promise<void>) {
      jobs.handler = h;
    }),
    enqueue: vi.fn(async (_ws: string, _kind: string, payload: unknown) => {
      jobs.payloads.push(payload);
      const done = o.jobDone ? o.jobDone() : jobs.handler!(payload);
      jobs.dones.push(done);
      return { id: `job-${jobs.dones.length}`, done };
    }),
  };

  const svc = new BriefService({
    db: {} as never,
    pulls,
    blast: blastPort,
    fileRole: (p: string) => (p.startsWith('test/') ? 'tests' : 'core'),
    agents,
    skills,
    projectContext,
    github: github as never,
    featureModel,
    hasLlmKey,
    llm: llmDep as never,
    jobs,
    logger,
    promptLogVerbose: false,
    renderPrompt,
    now: () => new Date('2026-11-01T10:00:00.000Z'),
    generationTimeoutMs: o.generationTimeoutMs,
  });

  const structuredCalls = () => llm.calls.filter((c) => c.method === 'completeStructured');
  const req = (i = -1) => structuredCalls().at(i)!.req as StructuredRequest<unknown>;
  const user = (i = -1) => req(i).messages[1]!.content;
  const system = (i = -1) => req(i).messages[0]!.content;
  const stored = () => store.rows.get(PR) as PrBrief | undefined;
  const event = (name: string) => logs.filter((l) => l.obj.event === name);
  const settle = async () => {
    await Promise.allSettled(jobs.dones);
    await new Promise((r) => setTimeout(r, 0));
  };
  const generate = async () => {
    await svc.startGeneration(WS, PR);
    await settle();
  };
  return {
    svc, llm, state, seen, pulls, blastPort, agents, skills, projectContext, gh, getIssue, github, featureModel, hasLlmKey,
    llmDep, jobs, logs, structuredCalls, req, user, system, stored, event, settle, generate,
  };
}

const rejectionOf = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e as AppError);

beforeEach(() => {
  store.rows.clear();
  store.upserts = 0;
  store.failUpsert = null;
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------

describe('one model call per generation (R-11, R-12, R-73)', () => {
  it('exactly one completeStructured: maxRetries 0, 2,000 tokens, 60 s, temperature 0, the feature model', async () => {
    const s = setup();
    await s.generate();
    expect(s.structuredCalls()).toHaveLength(1);
    expect(s.req()).toMatchObject({ model: 'gpt-4.1', maxRetries: 0, maxTokens: 2_000, timeoutMs: 60_000, temperature: 0 });
    expect(s.stored()).toBeDefined();
  });

  it('R-11 — the "Risk Brief" choice decides provider and model', async () => {
    const s = setup({ choice: { provider: 'openrouter', model: 'meta/llama-x' } });
    await s.generate();
    expect(s.llmDep).toHaveBeenCalledTimes(1);
    expect(s.llmDep).toHaveBeenCalledWith('openrouter');
    expect(s.req().model).toBe('meta/llama-x');
    expect(s.stored()!.meta).toMatchObject({ provider: 'openrouter', model: 'meta/llama-x' });
  });

  it('R-73, F-12 — a reasoning model gets 10,000 tokens and ~115 s minus collection time; the finished line matches', async () => {
    const s = setup({ choice: { provider: 'openai', model: 'openai/gpt-5' } });
    await s.generate();
    const r = s.req();
    expect(r.maxTokens).toBe(10_000);
    expect(r.timeoutMs).toBeLessThanOrEqual(115_000);
    expect(r.timeoutMs).toBeGreaterThan(110_000);
    const fin = s.event('brief.generation.finished')[0]!.obj;
    expect(fin).toMatchObject({ max_tokens: 10_000, timeout_ms: r.timeoutMs, reasoning: true });
  });

  it('R-73 — the default model: the finished line reports 2,000 / 60,000 / not reasoning', async () => {
    const s = setup();
    await s.generate();
    expect(s.event('brief.generation.finished')[0]!.obj).toMatchObject({ max_tokens: 2_000, timeout_ms: 60_000, reasoning: false });
  });

  it('F-12 — a 100 s collection leaves the call 15 s (120 − 5 − 100), whatever the model', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-01T09:00:00Z'));
    for (const model of ['openai/gpt-5', 'gpt-4.1']) {
      store.rows.clear();
      const s = setup({
        choice: { provider: 'openai', model },
        getPrFiles: async () => {
          vi.setSystemTime(Date.now() + 100_000);
          return FILES;
        },
      });
      await s.generate();
      expect(s.req().timeoutMs).toBe(15_000);
      expect(s.event('brief.generation.finished')[0]!.obj.timeout_ms).toBe(15_000);
    }
  });

  it('F-12 — no time left after collection → no call at all, failure "timed out"', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-01T09:00:00Z'));
    const s = setup({
      getPrFiles: async () => {
        vi.setSystemTime(Date.now() + 116_000);
        return FILES;
      },
    });
    await s.generate();
    expect(s.structuredCalls()).toHaveLength(0);
    const v = await s.svc.getView(WS, PR);
    expect(v.last_failure).toMatchObject({ code: 'timeout', message: 'timed out' });
    expect(s.event('brief.generation.finished')[0]!.obj).toMatchObject({ outcome: 'failure', model_calls: 0 });
  });

  it('D-39 — the runner re-invoking the handler (after its 120 s wall) makes no second call', async () => {
    const llm = new GatedLLM(ANSWER);
    const s = setup({ llm });
    await s.svc.startGeneration(WS, PR);
    const payload = s.jobs.payloads[0];
    // the runner gives up on its wall and calls the handler again with the same payload
    await expect(s.jobs.handler!(payload)).resolves.toBeUndefined();
    // the first handler still runs and still holds the lock
    expect((await s.svc.getView(WS, PR)).generating).toBe(true);
    llm.release();
    await s.settle();
    await s.jobs.handler!(payload); // and once more after it finished
    expect(s.structuredCalls()).toHaveLength(1);
    expect(store.upserts).toBe(1);
    const v = await s.svc.getView(WS, PR);
    expect(v.generating).toBe(false);
    expect(v.last_failure).toBeNull();
    expect(v.brief).not.toBeNull();
  });

  it('R-17 — an LLM rejection is recorded; the handler resolves, so the runner never retries it', async () => {
    const llm = new FailingLLM(new Error('upstream 503'));
    const s = setup({ llm: llm as RecordingLLM });
    await s.svc.startGeneration(WS, PR);
    await expect(s.jobs.dones[0]!).resolves.toBeUndefined();
    expect(s.structuredCalls()).toHaveLength(1);
  });
});

describe('the input sent to the model (R-09, R-26, R-37, R-64, R-65, D-37)', () => {
  it('the PR title is in its own untrusted block right after the header', async () => {
    const s = setup();
    await s.generate();
    const user = s.user();
    expect(user).toContain(wrapUntrusted('pr-title', TITLE));
    expect(user.indexOf('<untrusted source="pr-title">')).toBeLessThan(user.indexOf('<untrusted source="intent">'));
    expect(user.startsWith('Facts about this pull request follow. Missing inputs: none\n\n<untrusted source="pr-title">')).toBe(true);
  });

  it('INV-9 — patch text and hunk headers never reach the model; changed-line ranges do', async () => {
    const files = [{ path: 'src/a.ts', additions: 1, deletions: 0, patch: '@@ -1,1 +1,2 @@\n ctx\n+const PATCH_MARKER_7781 = 1;' }];
    const s = setup({ files });
    await s.generate();
    expect(s.user()).not.toContain('PATCH_MARKER_7781');
    expect(s.user()).not.toContain('@@');
    expect(s.system()).not.toContain('PATCH_MARKER_7781');
    expect(s.user()).toContain('src/a.ts | core | +1 -0 | lines: 2');
  });

  it('rows path-ascending with the Smart Diff role; blast callers; description CRLF-normalised', async () => {
    const s = setup();
    await s.generate();
    expect(s.user()).toContain(
      wrapUntrusted(
        'changed-files',
        'src/limiter.ts | core | +3 -0 | lines: 2-4\nsrc/routes/public.ts | core | +1 -1 | lines: 10\ntest/limiter.test.ts | tests | +5 -0 | lines: none',
      ),
    );
    expect(s.user()).toContain(wrapUntrusted('blast-radius', '1 changed symbol, 1 caller\nhandler — src/server.ts:40'));
    expect(s.user()).toContain(wrapUntrusted('pr-description', 'Adds a token-bucket limiter.\n\nCloses #12 and fixes #13.'));
  });

  it('R-64 — only the FIRST closing-keyword issue is fetched, from the PR\'s repo; body cut to 4,000', async () => {
    const s = setup({ getIssue: async (_r, n) => ({ number: n, title: 'Public API is abused', body: 'x'.repeat(5000) }) });
    await s.generate();
    expect(s.getIssue).toHaveBeenCalledTimes(1);
    expect(s.getIssue).toHaveBeenCalledWith({ owner: 'acme', name: 'api' }, 12);
    expect(s.user()).toContain('<untrusted source="linked-issue #12">\nPublic API is abused\n\n' + 'x'.repeat(4000) + '\n</untrusted>');
    expect(s.user()).not.toContain('x'.repeat(4001));
  });

  it('R-65 — specs: union of every enabled agent\'s and its skills\' docs, path asc, resolved once', async () => {
    const s = setup();
    await s.generate();
    expect(s.projectContext.resolveForPrompt).toHaveBeenCalledTimes(1);
    expect(s.projectContext.resolveForPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'acme', name: 'api', clonePath: '/clones/acme/api' }),
      { agent: ['docs/c.md', 'specs/a.md', 'specs/b.md'], skills: [] },
    );
    const u = s.user();
    const at = (p: string) => u.indexOf(`<untrusted source="spec:${p}">`);
    expect(at('docs/c.md')).toBeGreaterThan(0);
    expect(at('docs/c.md')).toBeLessThan(at('specs/a.md'));
    expect(at('specs/a.md')).toBeLessThan(at('specs/b.md'));
  });

  it('R-23, AP-7 — a spec the project-context budget skipped is trimmed, not missing', async () => {
    const s = setup({
      resolve: async () => ({
        docs: [{ path: 'docs/c.md', text: 'c', chars: 1, truncated: false }],
        skipped: [{ path: 'specs/b.md', reason: 'budget' }],
      }),
    });
    await s.generate();
    const meta = s.stored()!.meta;
    expect(meta.trim.specs_removed).toContain('specs/b.md');
    expect(meta.missing_inputs.map((m) => m.input)).not.toContain('specs');
  });

  it('R-26 — the same facts twice give byte-identical system and user messages', async () => {
    const s = setup();
    await s.generate();
    await s.generate();
    expect(s.structuredCalls()).toHaveLength(2);
    expect(s.user(1)).toBe(s.user(0));
    expect(s.system(1)).toBe(s.system(0));
  });
});

describe('the two log lines (R-13, R-14, D-20)', () => {
  it('one prompt.assembled (kind brief) whose size equals the request; one finished line', async () => {
    const s = setup();
    await s.generate();
    const assembled = s.event('prompt.assembled');
    expect(assembled).toHaveLength(1);
    const a = assembled[0]!.obj;
    const chars = s.system().length + s.user().length;
    expect(a).toMatchObject({ kind: 'brief', pr_id: PR, provider: 'openai', model: 'gpt-4.1', total_chars: chars });
    expect(a.total_approx_tokens).toBe(Math.ceil(chars / 4));
    expect(a.total_approx_tokens as number).toBeLessThanOrEqual(8000);

    const finished = s.event('brief.generation.finished');
    expect(finished).toHaveLength(1);
    const f = finished[0]!;
    expect(f.level).toBe('info');
    expect(f.obj).toMatchObject({
      pr_id: PR,
      outcome: 'success',
      failure_code: null,
      provider: 'openai',
      model: 'gpt-4.1',
      model_calls: 1,
      tokens_in: 100,
      tokens_out: 50,
      cost_usd: 0.001,
      dropped: { risks: 1, risk_refs: 2, review_focus: 1 },
    });
    expect(typeof f.obj.duration_ms).toBe('number');
    expect(f.obj.trim).toMatchObject({ specs_removed: [], description: 'kept', callers_removed: 0, focus_lines_moved: 1 });
    expect(f.obj.correlation_id).toBe(a.correlation_id);
  });

  it('cost unknown → "unknown" in the finished line', async () => {
    const s = setup({ llm: new NoCostLLM('openai', { structured: ANSWER }) });
    await s.generate();
    expect(s.event('brief.generation.finished')[0]!.obj.cost_usd).toBe('unknown');
    expect(s.stored()!.meta.cost_usd).toBeNull();
  });

  it('no input text in either line', async () => {
    const s = setup();
    await s.generate();
    const dump = JSON.stringify(s.logs.map((l) => [l.obj, l.msg]));
    for (const text of [TITLE, 'token-bucket limiter', 'Bots hammer', 'SPEC TEXT OF', 'Rate-limit the public API']) {
      expect(dump).not.toContain(text);
    }
  });
});

describe('the stored brief (R-16, R-30, R-34, R-41, R-42)', () => {
  it('grounded, snapped and counted, with the head SHA it was generated for', async () => {
    const s = setup();
    await s.generate();
    const b = s.stored()!;
    expect(b.summary).toBe('Adds a limiter to the public API.');
    expect(b.risks.risks.map((r) => [r.title, r.file_refs])).toEqual([['Limiter bypass', ['src/limiter.ts:2-4']]]);
    expect(b.review_focus).toEqual([
      { file: 'src/limiter.ts', line: 3, reason: 'the limit itself' },
      { file: 'src/server.ts', line: 40, reason: 'the caller' },
    ]);
    expect(b.history).toBeNull();
    expect(b.intent?.intent).toBe('Rate-limit the public API');
    expect(b.blast?.summary).toBe('1 changed symbol, 1 caller');
    expect(b.meta).toMatchObject({
      head_sha: 'head-1',
      generated_at: '2026-11-01T10:00:00.000Z',
      provider: 'openai',
      model: 'gpt-4.1',
      tokens_in: 100,
      tokens_out: 50,
      cost_usd: 0.001,
      missing_inputs: [],
      dropped: { risks: 1, risk_refs: 2, review_focus: 1 },
    });
    expect(b.meta.trim.focus_lines_moved).toBe(1);
  });

  it('a second generation replaces the first (R-16)', async () => {
    const s = setup();
    await s.generate();
    s.state.pull.headSha = 'head-2';
    await s.generate();
    expect(store.upserts).toBe(2);
    expect(s.stored()!.meta.head_sha).toBe('head-2');
  });
});

describe('R-10 — reads only, by construction', () => {
  it('only the INV-4 read members are touched; the GitHub port is used for getIssue only', async () => {
    const s = setup();
    await s.generate();
    expect(s.stored()).toBeDefined();
    expect((await s.svc.getView(WS, PR)).last_failure).toBeNull();
    const allowed = new Set([
      'pulls.getPull',
      'pulls.getRepo',
      'pulls.getPrFiles',
      'pulls.getIntent',
      'blast.forResolvedPull',
      'agents.listEnabled',
      'agents.enabledContextDocPaths',
      'skills.promptContextDocsForAgent',
      'projectContext.resolveForPrompt',
      'github.getIssue',
    ]);
    expect([...new Set(s.seen)].filter((m) => !allowed.has(m))).toEqual([]);
    expect(s.seen).toContain('github.getIssue');
  });
});

describe('failures (R-17, R-38, R-60, F-04)', () => {
  it('R-38 — an invalid answer: invalid_output, nothing stored, the old brief kept, still one call', async () => {
    const good = setup();
    await good.generate();
    const before = good.stored();
    const bad = { ...ANSWER, review_focus: [{ file: 'src/limiter.ts', line: 2.5, reason: 'x' }] };
    const s = setup({ llm: new MockLLMProvider('openai', { structured: bad }) });
    await s.generate();
    expect(s.structuredCalls()).toHaveLength(1);
    expect(store.upserts).toBe(1); // only the first, good generation
    const v = await s.svc.getView(WS, PR);
    expect(v.last_failure).toMatchObject({ code: 'invalid_output', message: 'The model returned invalid output' });
    expect(v.brief).toEqual(before);
    expect(s.event('brief.generation.finished')[0]!).toMatchObject({ level: 'warn', obj: { outcome: 'failure', failure_code: 'invalid_output', model_calls: 1 } });
  });

  it('R-60 — the provider\'s reason is kept, secrets masked (F-04)', async () => {
    const s = setup({ llm: new FailingLLM(new Error('401 Incorrect API key provided: sk-proj-AbCdEf0123456789')) as RecordingLLM });
    await s.generate();
    const f = (await s.svc.getView(WS, PR)).last_failure!;
    expect(f.code).toBe('provider_error');
    expect(f.message).toContain('401 Incorrect API key provided');
    expect(f.message).not.toContain('AbCdEf0123456789');
    expect(s.stored()).toBeUndefined();
  });

  it('R-60 — a call that never answers → "timed out", nothing stored', async () => {
    const s = setup({ llm: new HangingLLM('openai'), generationTimeoutMs: 50 });
    await s.generate();
    expect(s.structuredCalls()).toHaveLength(1);
    expect((await s.svc.getView(WS, PR)).last_failure).toMatchObject({ code: 'timeout', message: 'timed out' });
    expect(s.stored()).toBeUndefined();
  });

  it('F-04 — a non-model failure gets the fixed text; the real cause goes to the warn line only', async () => {
    const s = setup({ getIntent: async () => Promise.reject(new Error('connect ECONNREFUSED 10.0.0.5:5432 /home/me/db')) });
    await s.generate();
    expect(s.structuredCalls()).toHaveLength(0);
    const f = (await s.svc.getView(WS, PR)).last_failure!;
    expect(f.message).toBe('The brief could not be generated');
    const fin = s.event('brief.generation.finished')[0]!;
    expect(fin.level).toBe('warn');
    expect(fin.obj.model_calls).toBe(0);
    expect(JSON.stringify(fin.obj)).toContain('ECONNREFUSED');
  });

  it('R-17 — a store failure: store_failed, still exactly one call', async () => {
    store.failUpsert = new Error('deadlock detected');
    const s = setup();
    await s.generate();
    expect(s.structuredCalls()).toHaveLength(1);
    expect((await s.svc.getView(WS, PR)).last_failure).toMatchObject({ code: 'store_failed', message: 'Could not save the brief' });
  });

  it('D-7 — the runner fails before the handler runs: failure recorded, lock released, no call', async () => {
    const s = setup({ jobDone: () => Promise.reject(new Error('runner down')) });
    await s.svc.startGeneration(WS, PR);
    await s.settle();
    const v = await s.svc.getView(WS, PR);
    expect(v.generating).toBe(false);
    expect(v.last_failure).toMatchObject({ code: 'provider_error', message: 'The generation could not start' });
    expect(s.structuredCalls()).toHaveLength(0);
    expect(s.event('brief.generation.finished')).toHaveLength(1);
  });
});

describe('starting a generation (R-15, R-18, R-39, INV-7)', () => {
  it('two starts without an await between them → one 409 with the R-15 message, one model call', async () => {
    const llm = new GatedLLM(ANSWER);
    const s = setup({ llm });
    const results = await Promise.allSettled([s.svc.startGeneration(WS, PR), s.svc.startGeneration(WS, PR)]);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toMatchObject({
      code: 'brief_generation_running',
      statusCode: 409,
      message: 'A brief is already being generated for this PR',
    });
    llm.release();
    await s.settle();
    expect(s.structuredCalls()).toHaveLength(1);
    expect(s.jobs.enqueue).toHaveBeenCalledTimes(1);
  });

  it('no key → 409 brief_no_api_key with the exact text, no llm(), no call, lock released', async () => {
    const s = setup({ key: false });
    const err = await rejectionOf(s.svc.startGeneration(WS, PR));
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({
      code: 'brief_no_api_key',
      statusCode: 409,
      message: 'No API key for openai — add one in Settings → API Keys or pick another model for Risk Brief',
      details: { provider: 'openai' },
    });
    expect(s.llmDep).not.toHaveBeenCalled();
    expect(s.jobs.enqueue).not.toHaveBeenCalled();
    expect(s.structuredCalls()).toHaveLength(0);
    expect((await s.svc.getView(WS, PR)).generating).toBe(false);
    s.state.key = true;
    await expect(s.svc.startGeneration(WS, PR)).resolves.toBeUndefined();
  });

  it('llm() throwing ConfigError (key vanished) → the same 409, lock released', async () => {
    const s = setup({ llmDep: async () => Promise.reject(new ConfigError('OPENAI_API_KEY is not configured')) });
    const err = await rejectionOf(s.svc.startGeneration(WS, PR));
    expect(err).toMatchObject({ code: 'brief_no_api_key', statusCode: 409 });
    expect((await s.svc.getView(WS, PR)).generating).toBe(false);
  });

  it('R-18 — a PR of another workspace → 404 on read and on start, no lock taken', async () => {
    const s = setup();
    await expect(s.svc.getView('ws-other', PR)).rejects.toBeInstanceOf(NotFoundError);
    await expect(s.svc.startGeneration('ws-other', PR)).rejects.toBeInstanceOf(NotFoundError);
    await expect(s.svc.startGeneration(WS, 'pr-unknown')).rejects.toBeInstanceOf(NotFoundError);
    expect(s.jobs.enqueue).not.toHaveBeenCalled();
    await expect(s.svc.startGeneration(WS, PR)).resolves.toBeUndefined();
  });
});

describe('the read (R-02, R-03, R-43, R-45, R-69, R-75, INV-6)', () => {
  it('no brief yet: brief null, feature_model named, key flag — and no model, no llm(), no enqueue', async () => {
    const s = setup({ key: false });
    const v = await s.svc.getView(WS, PR);
    expect(v).toEqual({
      brief: null,
      stale: false,
      current_head_sha: 'head-1',
      generating: false,
      last_failure: null,
      key_available: false,
      feature_model: { provider: 'openai', model: 'gpt-4.1' },
    });
    expect(s.llmDep).not.toHaveBeenCalled();
    expect(s.jobs.enqueue).not.toHaveBeenCalled();
    expect(s.structuredCalls()).toHaveLength(0);
  });

  it('R-03 — a stored brief is served with no call; R-45 — a newer head SHA marks it stale', async () => {
    const s = setup();
    await s.generate();
    const calls = s.structuredCalls().length;
    const v1 = await s.svc.getView(WS, PR);
    expect(v1.brief?.summary).toBe('Adds a limiter to the public API.');
    expect(v1.stale).toBe(false);
    s.state.pull.headSha = 'head-2';
    const v2 = await s.svc.getView(WS, PR);
    expect(v2.stale).toBe(true);
    expect(v2.current_head_sha).toBe('head-2');
    expect(v2.brief?.meta.head_sha).toBe('head-1');
    expect(s.structuredCalls()).toHaveLength(calls);
    expect(s.jobs.enqueue).toHaveBeenCalledTimes(1);
  });

  it('R-44 — a stored json that does not parse reads as no brief', async () => {
    const s = setup();
    store.rows.set(PR, { intent: null, blast: null, risks: { risks: [] }, history: null });
    expect((await s.svc.getView(WS, PR)).brief).toBeNull();
  });

  it('R-69 — generating while the handler is pending, then the brief', async () => {
    const llm = new GatedLLM(ANSWER);
    const s = setup({ llm });
    await s.svc.startGeneration(WS, PR);
    const during = await s.svc.getView(WS, PR);
    expect(during.generating).toBe(true);
    expect(during.brief).toBeNull();
    llm.release();
    await s.settle();
    const after = await s.svc.getView(WS, PR);
    expect(after.generating).toBe(false);
    expect(after.brief).not.toBeNull();
  });

  it('R-75 — last_failure stays until the next ACCEPTED start (a rejected no-key start keeps it)', async () => {
    const gated = new GatedLLM(ANSWER);
    let first = true;
    const failing = new FailingLLM(new Error('upstream 500'));
    const s = setup({ llmDep: async () => (first ? ((first = false), failing) : gated) });
    await s.generate();
    expect((await s.svc.getView(WS, PR)).last_failure?.message).toBe('upstream 500');

    s.state.key = false;
    await rejectionOf(s.svc.startGeneration(WS, PR));
    expect((await s.svc.getView(WS, PR)).last_failure?.message).toBe('upstream 500');

    s.state.key = true;
    await s.svc.startGeneration(WS, PR);
    expect((await s.svc.getView(WS, PR)).last_failure).toBeNull();
    gated.release();
    await s.settle();
  });

  it('F-17 — while generating, polls reuse the model/key reads for ≤ 5 s; otherwise every read is fresh', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-01T09:00:00Z'));
    const llm = new GatedLLM(ANSWER);
    const s = setup({ llm });
    await s.svc.startGeneration(WS, PR);
    const base = s.featureModel.mock.calls.length;
    await s.svc.getView(WS, PR);
    await s.svc.getView(WS, PR);
    vi.setSystemTime(Date.now() + 4_000);
    await s.svc.getView(WS, PR);
    expect(s.featureModel.mock.calls.length - base).toBe(1);
    vi.setSystemTime(Date.now() + 1_500); // 5.5 s since the read
    await s.svc.getView(WS, PR);
    expect(s.featureModel.mock.calls.length - base).toBe(2);

    llm.release();
    await s.settle();
    const idle = s.featureModel.mock.calls.length;
    const keys = s.hasLlmKey.mock.calls.length;
    await s.svc.getView(WS, PR);
    await s.svc.getView(WS, PR);
    expect(s.featureModel.mock.calls.length - idle).toBe(2);
    expect(s.hasLlmKey.mock.calls.length - keys).toBe(2);
  });
});

describe('missing inputs (R-27, D-17)', () => {
  it('everything missing: still generated and stored; listed in order; the header names them', async () => {
    const s = setup({
      noIntent: true,
      blastFn: async () => blast({ degraded: true, reason: 'index_partial' }),
      files: [],
      body: '   ',
      agents: [],
    });
    await s.generate();
    expect(s.structuredCalls()).toHaveLength(1);
    const expected = [
      { input: 'intent', reason: 'not_derived' },
      { input: 'blast', reason: 'degraded:index_partial' },
      { input: 'diff_stats', reason: 'no_files' },
      { input: 'description', reason: 'empty' },
      { input: 'issue', reason: 'none_linked' },
      { input: 'specs', reason: 'none_attached' },
    ];
    expect(s.stored()!.meta.missing_inputs).toEqual(expected);
    expect(s.stored()!.intent).toBeNull();
    expect(s.user()).toContain(
      'Missing inputs: intent (not_derived), blast (degraded:index_partial), diff_stats (no_files), description (empty), issue (none_linked), specs (none_attached)',
    );
    expect(s.getIssue).not.toHaveBeenCalled();
  });

  it('blast no_data → no_index; a blast read that throws → degraded:error and blast null', async () => {
    const a = setup({ blastFn: async () => blast({ degraded: true, reason: 'no_data' }) });
    await a.generate();
    expect(a.stored()!.meta.missing_inputs).toEqual([{ input: 'blast', reason: 'no_index' }]);
    store.rows.clear();
    const b = setup({ blastFn: async () => Promise.reject(new Error('index offline')) });
    await b.generate();
    expect(b.stored()!.meta.missing_inputs).toEqual([{ input: 'blast', reason: 'degraded:error' }]);
    expect(b.stored()!.blast).toBeNull();
  });

  it('R-29 — a full index with zero callers is not missing', async () => {
    const s = setup({ blastFn: async () => blast({ downstream: [], counts: { symbols: 1, callers: 0, endpoints: 0, crons: 0 } }) });
    await s.generate();
    expect(s.stored()!.meta.missing_inputs).toEqual([]);
  });

  it('github() throws ConfigError → github_unavailable; getIssue throws → fetch_failed', async () => {
    const a = setup({ github: async () => Promise.reject(new ConfigError('GITHUB_TOKEN is not configured')) });
    await a.generate();
    expect(a.stored()!.meta.missing_inputs).toEqual([{ input: 'issue', reason: 'github_unavailable' }]);
    store.rows.clear();
    const b = setup({ getIssue: async () => Promise.reject(new Error('404 from GitHub')) });
    await b.generate();
    expect(b.stored()!.meta.missing_inputs).toEqual([{ input: 'issue', reason: 'fetch_failed' }]);
  });

  it('specs: not cloned → not_cloned; nothing readable → read_error', async () => {
    const a = setup({
      repo: { ...REPO, clonePath: null },
      resolve: async (_r, refs) => ({ docs: [], skipped: refs.agent.map((p) => ({ path: p, reason: 'not_cloned' })) }),
    });
    await a.generate();
    expect(a.stored()!.meta.missing_inputs).toEqual([{ input: 'specs', reason: 'not_cloned' }]);
    store.rows.clear();
    const b = setup({ resolve: async (_r, refs) => ({ docs: [], skipped: refs.agent.map((p) => ({ path: p, reason: 'read_error' })) }) });
    await b.generate();
    expect(b.stored()!.meta.missing_inputs).toEqual([{ input: 'specs', reason: 'read_error' }]);
  });
});
