/**
 * How a run that produced no review is reported (get_findings without run_id),
 * a start that returned another agent's run, and the run-error quote cap.
 * Ring 2 handlers with a fake port — no SDK, no fetch.
 */
import { describe, expect, it } from 'vitest';
import type { RunSummary } from '../src/api/types.js';
import { ToolError } from '../src/errors.js';
import { RUN_ERROR_MAX, runEndedError, type ToolDeps } from '../src/tools/context.js';
import { getFindings } from '../src/tools/get-findings.js';
import { runAgentOnPr } from '../src/tools/run-agent-on-pr.js';
import { AGENT_ID, fakeApi, makeAgent, makeRun, virtualClock, type FakeState } from './fixtures.js';

const PERF_ID = 'perf-id';
const AGENTS = [makeAgent(), makeAgent({ id: PERF_ID, name: 'perf' })];

function deps(over: Partial<FakeState> = {}) {
  const api = fakeApi({ agents: AGENTS, reviews: [], ...over });
  const clock = virtualClock();
  const d: ToolDeps = { api, runWaitMs: 240_000, pollIntervalMs: 3_000, now: clock.now, sleep: clock.sleep };
  return { d, api };
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

const run = (o: Partial<RunSummary>) => makeRun({ ran_at: '2026-10-01T00:00:00Z', ...o });
const WHERE = { repo: 'acme/api', pr: 42 };

/** The same matrix with and without the `agent` filter. */
const MODES = [
  { mode: 'without agent', args: WHERE, agentId: AGENT_ID },
  { mode: 'with agent', args: { ...WHERE, agent: 'perf' }, agentId: PERF_ID },
] as const;

describe.each(MODES)('get_findings, no review and no run_id ($mode): the newest matching run decides', ({ args, agentId }) => {
  it('newest is running → a running result, even when an older run failed', async () => {
    const { d } = deps({
      runsSequence: [[
        run({ run_id: 'old-failed', agent_id: agentId, status: 'failed', error: 'boom', ran_at: '2026-10-01T00:00:00Z' }),
        run({ run_id: 'new-running', agent_id: agentId, status: 'running', ran_at: '2026-10-02T00:00:00Z' }),
      ]],
    });
    const out = await getFindings(d, args);
    expect(out.data).toMatchObject({ status: 'running', run_id: 'new-running' });
    expect(out.data.next).toContain('run_id="new-running"');
  });

  it('newest failed with an error → run_failed quoting it, even when an older run is still running; never "start"', async () => {
    const { d } = deps({
      runsSequence: [[
        run({ run_id: 'old-running', agent_id: agentId, status: 'running', ran_at: '2026-10-01T00:00:00Z' }),
        run({ run_id: 'new-failed', agent_id: agentId, status: 'failed', error: 'diff too large', ran_at: '2026-10-03T00:00:00Z' }),
      ]],
    });
    const e = await toolError(getFindings(d, args));
    expect(e.code).toBe('run_failed');
    expect(e.message).toContain('new-failed');
    expect(e.message).toContain('diff too large');
    expect(e.message).not.toMatch(/\bstart/i);
  });

  it('newest failed with error null → run_reaped; never "start", never not_reviewed', async () => {
    const { d } = deps({ runsSequence: [[run({ agent_id: agentId, status: 'failed', error: null })]] });
    const e = await toolError(getFindings(d, args));
    expect(e.code).toBe('run_reaped');
    expect(e.message).toContain('API restarted and reaped the run');
    expect(e.message).not.toMatch(/\bstart/i);
  });

  it('newest cancelled → run_cancelled', async () => {
    const { d } = deps({ runsSequence: [[run({ agent_id: agentId, status: 'cancelled' })]] });
    const e = await toolError(getFindings(d, args));
    expect(e.code).toBe('run_cancelled');
    expect(e.message).toContain('run_agent_on_pr');
  });

  it('newest finished without a stored review → review_not_found', async () => {
    const { d } = deps({ runsSequence: [[run({ run_id: 'r-done', agent_id: agentId, status: 'done' })]] });
    const e = await toolError(getFindings(d, args));
    expect(e.code).toBe('review_not_found');
    expect(e.message).toContain('r-done');
  });

  it('a run without ran_at sorts after one with a timestamp', async () => {
    const { d } = deps({
      runsSequence: [[
        run({ run_id: 'undated-running', agent_id: agentId, status: 'running', ran_at: null }),
        run({ run_id: 'dated-failed', agent_id: agentId, status: 'failed', error: 'x' }),
      ]],
    });
    const e = await toolError(getFindings(d, args));
    expect(e.code).toBe('run_failed');
    expect(e.message).toContain('dated-failed');
  });

  it('no run at all → not_reviewed pointing at run_agent_on_pr', async () => {
    const { d } = deps({ runsSequence: [[]] });
    const e = await toolError(getFindings(d, args));
    expect(e.code).toBe('not_reviewed');
    expect(e.message).toContain('run_agent_on_pr');
  });
});

describe('get_findings, agent filter', () => {
  it("another agent's newer failed run does not decide for the filtered agent", async () => {
    const { d } = deps({
      runsSequence: [[
        run({ run_id: 'perf-running', agent_id: PERF_ID, status: 'running', ran_at: '2026-10-01T00:00:00Z' }),
        run({ run_id: 'sec-failed', agent_id: AGENT_ID, status: 'failed', error: 'x', ran_at: '2026-10-05T00:00:00Z' }),
      ]],
    });
    const out = await getFindings(d, { ...WHERE, agent: 'perf' });
    expect(out.data).toMatchObject({ status: 'running', run_id: 'perf-running' });

    // …and without the filter the newest of all (security, failed) decides
    const all = deps({ runsSequence: [[
      run({ run_id: 'perf-running', agent_id: PERF_ID, status: 'running', ran_at: '2026-10-01T00:00:00Z' }),
      run({ run_id: 'sec-failed', agent_id: AGENT_ID, status: 'failed', error: 'x', ran_at: '2026-10-05T00:00:00Z' }),
    ]] });
    expect((await toolError(getFindings(all.d, WHERE))).code).toBe('run_failed');
  });

  it('only other agents have runs → not_reviewed naming the agent', async () => {
    const { d } = deps({ runsSequence: [[run({ agent_id: AGENT_ID, status: 'failed', error: 'x' })]] });
    const e = await toolError(getFindings(d, { ...WHERE, agent: 'perf' }));
    expect(e.code).toBe('not_reviewed');
    expect(e.message).toContain('by perf');
  });
});

describe('run_agent_on_pr: the start response', () => {
  it("runs that do not include the requested agent → start_mismatch naming list_agents; no fallback to runs[0]", async () => {
    const { d, api } = deps({
      start: { pr_id: 'p', runs: [{ run_id: 'run-of-perf', agent_id: PERF_ID, agent_name: 'perf' }], reviews: [] },
    });
    const e = await toolError(runAgentOnPr(d, { ...WHERE, agent: 'security' }));
    expect(e.code).toBe('start_mismatch');
    expect(e.message).toContain('list_agents');
    expect(api.listRuns).not.toHaveBeenCalled(); // never waited on the other agent's run
    expect(api.listReviews).not.toHaveBeenCalled();
  });

  it('an empty runs list → bad_response, without waiting', async () => {
    const { d, api } = deps({ start: { pr_id: 'p', runs: [], reviews: [] } });
    const e = await toolError(runAgentOnPr(d, { ...WHERE, agent: 'security' }));
    expect(e.code).toBe('bad_response');
    expect(api.listRuns).not.toHaveBeenCalled();
  });
});

describe('runEndedError: hint on the full error, quote capped at RUN_ERROR_MAX', () => {
  it.each(['invalid API key', 'Unauthorized', 'HTTP 401 from provider', 'missing api_key'])(
    'the Settings hint fires for %j sitting past char 300, while the quote is cut',
    (trigger) => {
      const error = `${'x'.repeat(320)} ${trigger}`;
      const e = runEndedError({ run_id: 'r1', status: 'failed', error });
      expect(e.code).toBe('run_failed');
      expect(e.message).toContain('DevDigest Settings');
      const quoted = /failed: (.*)\. Add or fix/.exec(e.message)?.[1];
      expect(quoted).toBeDefined();
      expect(quoted!.length).toBe(RUN_ERROR_MAX);
      expect(quoted!.endsWith('…')).toBe(true);
      expect(quoted).not.toContain(trigger);
    },
  );

  it('a long error without a trigger gets the generic hint and the same cap', () => {
    const e = runEndedError({ run_id: 'r1', status: 'failed', error: 'z'.repeat(1_000) });
    expect(e.message).not.toContain('Settings');
    expect(e.message).toContain('Fix the cause');
    const quoted = /failed: (.*)\. Fix the cause/.exec(e.message)?.[1];
    expect(quoted!.length).toBe(RUN_ERROR_MAX);
  });
});
