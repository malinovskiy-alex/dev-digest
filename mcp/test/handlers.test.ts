/**
 * Ring 2 handlers driven directly with a fake `DevDigestApi`. No SDK, no fetch.
 */
import { describe, expect, it } from 'vitest';
import { ToolError } from '../src/errors.js';
import type { ToolDeps } from '../src/tools/context.js';
import { getBlastRadius } from '../src/tools/get-blast-radius.js';
import { getConventions } from '../src/tools/get-conventions.js';
import { getFindings } from '../src/tools/get-findings.js';
import { listAgents } from '../src/tools/list-agents.js';
import { runAgentOnPr } from '../src/tools/run-agent-on-pr.js';
import type { Progress } from '../src/wait.js';
import {
  AGENT_ID,
  fakeApi,
  makeAgent,
  makeFinding,
  makeRepo,
  makeReview,
  makeRun,
  PR_ID,
  REPO_ID,
  RUN_ID,
  virtualClock,
  type FakeState,
} from './fixtures.js';

function deps(over: Partial<FakeState> = {}, runWaitMs = 240_000) {
  const api = fakeApi(over);
  const clock = virtualClock();
  const d: ToolDeps = { api, runWaitMs, pollIntervalMs: 3_000, now: clock.now, sleep: clock.sleep };
  return { d, api, clock };
}

async function toolError(p: Promise<unknown>): Promise<ToolError> {
  const err = await p.then(
    () => {
      throw new Error('expected a ToolError, the handler resolved');
    },
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ToolError);
  return err as ToolError;
}

const ARGS = { repo: 'ACME/api', pr: 42, agent: 'Security' };

describe('run_agent_on_pr', () => {
  it('happy path: resolves names to ids, POSTs the agent uuid, waits, and returns the review of THAT run', async () => {
    const { d, api } = deps({
      runsSequence: [[makeRun({ status: 'running' })], [makeRun({ status: 'done' })]],
      reviews: [
        // same run, but a summary — must be skipped
        makeReview({ id: 'summary', kind: 'summary', run_id: RUN_ID, verdict: 'WRONG-summary' }),
        // a different, newer run of the same agent — must be skipped
        makeReview({ id: 'other', run_id: 'run-other', verdict: 'WRONG-other', created_at: '2026-12-01T00:00:00Z' }),
        makeReview({
          id: 'mine',
          run_id: RUN_ID,
          verdict: 'request_changes',
          score: 41,
          findings: [makeFinding({ id: 'f-crit', severity: 'CRITICAL' })],
        }),
      ],
    });
    const progress: Progress[] = [];

    const out = await runAgentOnPr(d, ARGS, { onProgress: (p) => progress.push(p) });

    expect(api.startReview).toHaveBeenCalledTimes(1);
    expect(api.startReview).toHaveBeenCalledWith(PR_ID, AGENT_ID, undefined);
    expect(api.listPulls).toHaveBeenCalledWith(REPO_ID, undefined);
    expect(out.data).toMatchObject({
      repo: 'acme/api',
      pr: 42,
      run_id: RUN_ID,
      agent: 'security',
      status: 'done',
      verdict: 'request_changes',
      score: 41,
      counts: { CRITICAL: 1, WARNING: 0, SUGGESTION: 0 },
    });
    expect(out.data.findings.map((f) => f.id)).toEqual(['f-crit']);
    expect(out.data.reused_run).toBeUndefined();
    expect(progress).toHaveLength(1);
    expect(out.text.split('\n')[0]).toBe('acme/api#42 · security · request_changes · score 41 · 1 CRITICAL 0 WARNING 0 SUGGESTION');
  });

  it('D11: an in-flight run of the same agent is joined — no startReview, reused_run true', async () => {
    const { d, api } = deps({
      active: [
        { run_id: 'run-of-another-agent', agent_id: 'someone-else', agent_name: 'perf', ran_at: null },
        { run_id: 'run-old', agent_id: AGENT_ID, agent_name: 'security', ran_at: null },
      ],
      runsSequence: [[makeRun({ run_id: 'run-old', status: 'done' })]],
      reviews: [makeReview({ run_id: 'run-old', verdict: 'approve' })],
    });

    const out = await runAgentOnPr(d, ARGS);

    expect(api.startReview).not.toHaveBeenCalled();
    expect(out.data.reused_run).toBe(true);
    expect(out.data.run_id).toBe('run-old');
    expect(out.data.verdict).toBe('approve');
  });

  it("another agent's in-flight run does not count as a reuse", async () => {
    const { d, api } = deps({
      active: [{ run_id: 'run-x', agent_id: 'someone-else', agent_name: 'perf', ran_at: null }],
    });
    const out = await runAgentOnPr(d, ARGS);
    expect(api.startReview).toHaveBeenCalledTimes(1);
    expect(out.data.reused_run).toBeUndefined();
  });

  it('timeout → status running with run_id and a get_findings next step, not a throw', async () => {
    const { d, api } = deps({ runsSequence: [[makeRun({ status: 'running' })]] }, 10_000);

    const out = await runAgentOnPr(d, ARGS);

    expect(out.data.status).toBe('running');
    expect(out.data.run_id).toBe(RUN_ID);
    expect(out.data.next).toBe(`Still running — call get_findings later with run_id="${RUN_ID}".`);
    expect(out.data.findings).toEqual([]);
    expect(api.listReviews).not.toHaveBeenCalled();
    expect(out.text).toContain(RUN_ID);
  });

  it('the wait budget is measured from tool start, not from when polling begins', async () => {
    const { d, api, clock } = deps({ runsSequence: [[makeRun({ status: 'running' })]] }, 10_000);
    // resolving the repo is slow: 9 s of the 10 s budget are gone before the first poll
    api.listRepos.mockImplementationOnce(async () => {
      clock.advance(9_000);
      return [makeRepo()];
    });

    const out = await runAgentOnPr(d, ARGS);

    expect(out.data.status).toBe('running');
    expect(clock.sleeps).toEqual([1_000]);
  });

  it('a timed-out reused run keeps reused_run true', async () => {
    const { d } = deps(
      {
        active: [{ run_id: 'run-old', agent_id: AGENT_ID, agent_name: 'security', ran_at: null }],
        runsSequence: [[makeRun({ run_id: 'run-old', status: 'running' })]],
      },
      5_000,
    );
    const out = await runAgentOnPr(d, ARGS);
    expect(out.data).toMatchObject({ status: 'running', run_id: 'run-old', reused_run: true });
  });

  it('run failed with an API-key error → shows the error plus the Settings hint', async () => {
    const { d } = deps({ runsSequence: [[makeRun({ status: 'failed', error: 'OpenAI API key is missing' })]] });
    const e = await toolError(runAgentOnPr(d, ARGS));
    expect(e.code).toBe('run_failed');
    expect(e.message).toContain('OpenAI API key is missing');
    expect(e.message).toContain('Settings');
  });

  it('run failed with another error → shows the error, no Settings hint', async () => {
    const { d } = deps({ runsSequence: [[makeRun({ status: 'failed', error: 'diff too large' })]] });
    const e = await toolError(runAgentOnPr(d, ARGS));
    expect(e.code).toBe('run_failed');
    expect(e.message).toContain('diff too large');
    expect(e.message).not.toContain('Settings');
  });

  it('run failed with error null → "API restarted and reaped the run — run again"', async () => {
    const { d } = deps({ runsSequence: [[makeRun({ status: 'failed', error: null })]] });
    const e = await toolError(runAgentOnPr(d, ARGS));
    expect(e.code).toBe('run_reaped');
    expect(e.message).toContain('the API restarted and reaped the run — run again');
  });

  it('run cancelled → "Start a new one with run_agent_on_pr"', async () => {
    const { d } = deps({ runsSequence: [[makeRun({ status: 'cancelled' })]] });
    const e = await toolError(runAgentOnPr(d, ARGS));
    expect(e.code).toBe('run_cancelled');
    expect(e.message).toContain('Start a new one with run_agent_on_pr');
  });

  it('done but no stored review for the run → review_not_found, never another run', async () => {
    const { d, api } = deps({ reviews: [makeReview({ run_id: 'some-other-run' })] });
    const e = await toolError(runAgentOnPr(d, ARGS));
    expect(e.code).toBe('review_not_found');
    expect(api.startReview).toHaveBeenCalledTimes(1);
  });

  it('an unknown agent fails before anything is started', async () => {
    const { d, api } = deps();
    const e = await toolError(runAgentOnPr(d, { ...ARGS, agent: 'nope' }));
    expect(e.code).toBe('agent_unknown');
    expect(e.message).toContain('list_agents');
    expect(api.startReview).not.toHaveBeenCalled();
  });

  it('a bad repo format fails before any request', async () => {
    const { d, api } = deps();
    const e = await toolError(runAgentOnPr(d, { ...ARGS, repo: 'just-a-name' }));
    expect(e.code).toBe('bad_repo');
    expect(api.listRepos).not.toHaveBeenCalled();
    expect(api.startReview).not.toHaveBeenCalled();
  });
});

describe('get_findings', () => {
  const reviews = [
    makeReview({ id: 'perf-new', run_id: 'run-perf', agent_id: 'perf-id', agent_name: 'perf', verdict: 'perf-new', created_at: '2026-10-05T00:00:00Z' }),
    makeReview({ id: 'sec-old', run_id: 'run-sec-old', verdict: 'sec-old', created_at: '2026-10-01T00:00:00Z' }),
    makeReview({ id: 'sec-new', run_id: 'run-sec-new', verdict: 'sec-new', created_at: '2026-10-03T00:00:00Z' }),
    // newest of all, but a summary — never picked
    makeReview({ id: 'summary', kind: 'summary', run_id: 'run-sum', verdict: 'summary', created_at: '2026-10-09T00:00:00Z' }),
  ];
  const agents = [makeAgent(), makeAgent({ id: 'perf-id', name: 'perf' })];

  it('with no selector picks the newest kind==="review", never a summary, and never starts a run', async () => {
    const { d, api } = deps({ reviews, agents });
    const out = await getFindings(d, { repo: 'acme/api', pr: 42 });
    expect(out.data.verdict).toBe('perf-new');
    expect(out.data.status).toBe('done');
    expect(api.startReview).not.toHaveBeenCalled();
  });

  it('agent picks the newest review by that agent', async () => {
    const { d } = deps({ reviews, agents });
    const out = await getFindings(d, { repo: 'acme/api', pr: 42, agent: 'SECURITY' });
    expect(out.data.verdict).toBe('sec-new');
  });

  it('run_id picks that exact run, even when older', async () => {
    const { d } = deps({ reviews, agents });
    const out = await getFindings(d, { repo: 'acme/api', pr: 42, run_id: 'run-sec-old' });
    expect(out.data.verdict).toBe('sec-old');
    expect(out.data.run_id).toBe('run-sec-old');
  });

  it('a run_id that points at a summary is not treated as a review', async () => {
    const { d } = deps({ reviews, agents, runsSequence: [[]] });
    const e = await toolError(getFindings(d, { repo: 'acme/api', pr: 42, run_id: 'run-sum' }));
    expect(e.code).toBe('run_not_found');
  });

  it('passes min_severity and limit through', async () => {
    const { d } = deps({
      reviews: [
        makeReview({
          findings: [
            makeFinding({ severity: 'CRITICAL' }),
            makeFinding({ severity: 'WARNING' }),
            makeFinding({ severity: 'WARNING' }),
            makeFinding({ severity: 'SUGGESTION' }),
          ],
        }),
      ],
    });
    const out = await getFindings(d, { repo: 'acme/api', pr: 42, min_severity: 'WARNING', limit: 2 });
    expect(out.data.total).toBe(3);
    expect(out.data.shown).toBe(2);
    expect(out.data.next).toBeDefined();
  });

  it('no review yet but a run in flight → status running (a result, not an error)', async () => {
    const { d } = deps({ reviews: [], runsSequence: [[makeRun({ run_id: 'run-live', status: 'running' })]] });
    const out = await getFindings(d, { repo: 'acme/api', pr: 42, agent: 'security' });
    expect(out.data).toMatchObject({ status: 'running', run_id: 'run-live', agent: 'security' });
    expect(out.data.next).toContain('run_id="run-live"');
  });

  it("another agent's in-flight run does not answer an agent-filtered query", async () => {
    const { d } = deps({
      agents,
      reviews: [],
      runsSequence: [[makeRun({ run_id: 'run-perf', agent_id: 'perf-id', status: 'running' })]],
    });
    const e = await toolError(getFindings(d, { repo: 'acme/api', pr: 42, agent: 'security' }));
    expect(e.code).toBe('not_reviewed');
    expect(e.message).toContain('by security');
  });

  it('never reviewed → not_reviewed pointing at run_agent_on_pr', async () => {
    const { d } = deps({ reviews: [], runsSequence: [[]] });
    const e = await toolError(getFindings(d, { repo: 'acme/api', pr: 42 }));
    expect(e.code).toBe('not_reviewed');
    expect(e.message).toContain('Call run_agent_on_pr');
  });

  it('unknown run_id → "Omit run_id to get the latest review"', async () => {
    const { d } = deps({ reviews, runsSequence: [[makeRun({ run_id: 'exists' })]] });
    const e = await toolError(getFindings(d, { repo: 'acme/api', pr: 42, run_id: 'nope' }));
    expect(e.code).toBe('run_not_found');
    expect(e.message).toContain('Omit run_id to get the latest review');
  });

  it('run_id of a run that failed → the run-failed error, of one still running → running', async () => {
    const failed = deps({ reviews: [], runsSequence: [[makeRun({ run_id: 'r-f', status: 'failed', error: null })]] });
    expect((await toolError(getFindings(failed.d, { repo: 'acme/api', pr: 42, run_id: 'r-f' }))).code).toBe('run_reaped');

    const live = deps({ reviews: [], runsSequence: [[makeRun({ run_id: 'r-l', status: 'running' })]] });
    const out = await getFindings(live.d, { repo: 'acme/api', pr: 42, run_id: 'r-l' });
    expect(out.data.status).toBe('running');
  });
});

describe('get_conventions', () => {
  it('resolves the repo id, keeps accepted conventions and reports the canonical repo name', async () => {
    const { d, api } = deps({
      conventions: {
        scan: { id: 's', repo_id: REPO_ID, sample_count: 9, model: 'm', created_at: '2026-09-01T00:00:00Z' },
        candidates: [
          { id: 'c1', repo_id: REPO_ID, category: 'naming', rule: 'R1', evidence_path: 'a.ts', evidence_start_line: 1, evidence_end_line: 4, evidence_snippet: 'x', confidence: 1, status: 'accepted', created_at: 'x' },
          { id: 'c2', repo_id: REPO_ID, category: 'naming', rule: 'R2', evidence_path: 'b.ts', evidence_start_line: 1, evidence_end_line: 2, evidence_snippet: 'x', confidence: 1, status: 'rejected', created_at: 'x' },
        ],
      },
    });
    const out = await getConventions(d, { repo: 'Acme/API' });
    expect(api.getConventions).toHaveBeenCalledWith(REPO_ID, undefined);
    expect(out.data.repo).toBe('acme/api');
    expect(out.data.conventions).toEqual([{ id: 'c1', category: 'naming', rule: 'R1', evidence: 'a.ts:1-4' }]);
    expect(out.data.sample_count).toBe(9);
  });

  it('scan:null → an empty result with next, not a throw', async () => {
    const { d } = deps({ conventions: { scan: null, candidates: [] } });
    const out = await getConventions(d, { repo: 'acme/api' });
    expect(out.data.conventions).toEqual([]);
    expect(out.data.next).toBeDefined();
  });
});

describe('list_agents', () => {
  it('returns the agents without system_prompt or output_schema', async () => {
    const { d } = deps({ agents: [makeAgent(), makeAgent({ id: 'b', name: 'perf', enabled: false })] });
    const out = await listAgents(d, {});
    expect(out.data.agents.map((a) => [a.name, a.enabled])).toEqual([
      ['security', true],
      ['perf', false],
    ]);
    expect(JSON.stringify(out)).not.toContain('SECRET SYSTEM PROMPT');
    expect(JSON.stringify(out.data)).not.toContain('output_schema');
  });
});

describe('get_blast_radius', () => {
  it('always throws not_implemented with the forward-leading hint, without calling the API', async () => {
    const { d, api } = deps();
    const e = await toolError(getBlastRadius(d, { repo: 'acme/api', pr: 42 }));
    expect(e.code).toBe('not_implemented');
    expect(e.message).toContain('not implemented yet (L04 homework) — use get_findings or Smart Diff in the UI');
    expect(api.listRepos).not.toHaveBeenCalled();
  });
});
