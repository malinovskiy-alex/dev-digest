/**
 * Test fixtures: builders for the API shapes and a fake `DevDigestApi` port.
 *
 * Not a test file (no `.test.ts` suffix) — vitest does not collect it, but the
 * tsconfig `include` typechecks it.
 */
import { vi } from 'vitest';
import type { DevDigestApi } from '../src/api/port.js';
import type {
  ActiveRun,
  Agent,
  ApiReview,
  ApiReviewFinding,
  BlastRadius,
  ConventionsView,
  PrMeta,
  Repo,
  RunSummary,
  StartRunResponse,
} from '../src/api/types.js';

export const REPO_ID = 'repo-uuid-1';
export const PR_ID = 'pr-uuid-42';
export const AGENT_ID = '11111111-1111-4111-8111-111111111111';
export const RUN_ID = 'run-uuid-new';

export function makeRepo(over: Partial<Repo> = {}): Repo {
  return {
    id: REPO_ID,
    workspace_id: 'ws-1',
    owner: 'acme',
    name: 'api',
    full_name: 'acme/api',
    default_branch: 'main',
    clone_path: null,
    last_polled_at: null,
    created_by: null,
    ...over,
  };
}

export function makePr(over: Partial<PrMeta> = {}): PrMeta {
  return {
    id: PR_ID,
    number: 42,
    title: 'Add thing',
    author: 'octo',
    branch: 'feat/thing',
    base: 'main',
    head_sha: 'abc123',
    additions: 10,
    deletions: 2,
    files_count: 3,
    status: 'open',
    ...over,
  };
}

export function makeAgent(over: Partial<Agent> = {}): Agent {
  return {
    id: AGENT_ID,
    name: 'security',
    description: 'Looks for security problems.',
    provider: 'openai',
    model: 'gpt-4o-mini',
    system_prompt: 'SECRET SYSTEM PROMPT',
    output_schema: { type: 'object' },
    enabled: true,
    version: 1,
    strategy: 'single-pass',
    ci_fail_on: 'critical',
    repo_intel: true,
    skill_count: 0,
    ...over,
  };
}

export function makeRun(over: Partial<RunSummary> = {}): RunSummary {
  return {
    run_id: RUN_ID,
    agent_id: AGENT_ID,
    agent_name: 'security',
    provider: 'openai',
    model: 'gpt-4o-mini',
    status: 'running',
    error: null,
    duration_ms: null,
    tokens_in: null,
    tokens_out: null,
    cost_usd: null,
    findings_count: null,
    grounding: null,
    ran_at: null,
    score: null,
    blockers: null,
    ...over,
  };
}

let findingSeq = 0;
export function makeFinding(over: Partial<ApiReviewFinding> = {}): ApiReviewFinding {
  findingSeq += 1;
  return {
    id: `f-${findingSeq}`,
    review_id: 'review-1',
    severity: 'WARNING',
    category: 'bug',
    title: `Finding ${findingSeq}`,
    file: 'src/a.ts',
    start_line: 1,
    end_line: 2,
    rationale: 'Because.',
    suggestion: 'SUGGESTION BODY MUST BE DROPPED',
    confidence: 0.9,
    evidence: null,
    accepted_at: null,
    dismissed_at: null,
    ...over,
  };
}

export function makeReview(over: Partial<ApiReview> = {}): ApiReview {
  return {
    id: 'review-1',
    pr_id: PR_ID,
    agent_id: AGENT_ID,
    run_id: RUN_ID,
    agent_name: 'security',
    kind: 'review',
    verdict: 'request_changes',
    summary: 'Summary text.',
    score: 41,
    model: 'gpt-4o-mini',
    created_at: '2026-10-01T10:00:00.000Z',
    findings: [],
    ...over,
  };
}

export function makeBlast(over: Partial<BlastRadius> = {}): BlastRadius {
  return {
    changed_symbols: [
      { name: 'getContext', file: 'src/ctx.ts', kind: 'function' },
      { name: 'unused', file: 'src/ctx.ts', kind: 'function' },
    ],
    downstream: [
      {
        symbol: 'getContext',
        callers: [
          { name: 'aRoutes', file: 'src/a/routes.ts', line: 12, endpoints: ['GET /a'], crons: [] },
          { name: 'bJobs', file: 'src/b/jobs.ts', line: 4, endpoints: [], crons: ['nightly'] },
        ],
        endpoints_affected: ['GET /a'],
        crons_affected: ['nightly'],
      },
    ],
    summary: '2 symbols changed · 2 callers · 1 endpoint · 1 cron',
    counts: { symbols: 2, callers: 2, endpoints: 1, crons: 1 },
    degraded: false,
    reason: null,
    index_status: 'full',
    indexed_sha: 'idx-sha',
    ...over,
  };
}

export interface FakeState {
  agents: Agent[];
  repos: Repo[];
  pulls: PrMeta[];
  active: ActiveRun[];
  /** Each `listRuns` call returns the next element; the last one repeats. */
  runsSequence: RunSummary[][];
  reviews: ApiReview[];
  conventions: ConventionsView;
  start: StartRunResponse;
  blast: BlastRadius;
}

export function defaultState(): FakeState {
  return {
    agents: [makeAgent()],
    repos: [makeRepo()],
    pulls: [makePr()],
    active: [],
    runsSequence: [[makeRun({ status: 'done' })]],
    reviews: [makeReview()],
    conventions: { scan: null, candidates: [] },
    start: {
      pr_id: PR_ID,
      runs: [{ run_id: RUN_ID, agent_id: AGENT_ID, agent_name: 'security' }],
      reviews: [],
    },
    blast: makeBlast(),
  };
}

/** A fake port: every method is a `vi.fn` serving `state`, so calls can be asserted. */
export function fakeApi(over: Partial<FakeState> = {}) {
  const st: FakeState = { ...defaultState(), ...over };
  let runsCall = 0;
  const api = {
    listAgents: vi.fn(async (_signal?: AbortSignal) => st.agents),
    listRepos: vi.fn(async (_signal?: AbortSignal) => st.repos),
    listPulls: vi.fn(async (_repoId: string, _signal?: AbortSignal) => st.pulls),
    activeRuns: vi.fn(async (_prId: string, _signal?: AbortSignal) => st.active),
    startReview: vi.fn(async (_prId: string, _agentId: string, _signal?: AbortSignal) => st.start),
    listRuns: vi.fn(async (_prId: string, _signal?: AbortSignal) => {
      const i = Math.min(runsCall, st.runsSequence.length - 1);
      runsCall += 1;
      return st.runsSequence[i] ?? [];
    }),
    listReviews: vi.fn(async (_prId: string, _signal?: AbortSignal) => st.reviews),
    getConventions: vi.fn(async (_repoId: string, _signal?: AbortSignal) => st.conventions),
    getBlastRadius: vi.fn(async (_prId: string, _signal?: AbortSignal) => st.blast),
  } satisfies DevDigestApi;
  return api;
}

/**
 * More sleeps than any bounded wait needs (240 s / 3 s = 80). Past it the wait
 * loop is unbounded, and a virtual sleep never yields to the event loop — so
 * fail loudly instead of letting the worker run out of memory.
 */
const MAX_VIRTUAL_SLEEPS = 1_000;

/** A virtual clock: `sleep` advances `now` instead of waiting. */
export function virtualClock(start = 1_000_000) {
  let t = start;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number, _signal?: AbortSignal) => {
      if (sleeps.length >= MAX_VIRTUAL_SLEEPS) {
        throw new Error(`virtual clock: more than ${MAX_VIRTUAL_SLEEPS} sleeps — the wait loop is not bounded by its deadline`);
      }
      sleeps.push(ms);
      t += ms;
    },
    advance: (ms: number) => {
      t += ms;
    },
    sleeps,
  };
}
