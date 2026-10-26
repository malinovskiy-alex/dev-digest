import { describe, expect, it } from 'vitest';
import { ToolError } from '../src/errors.js';
import { waitForRun, type Progress } from '../src/wait.js';
import { fakeApi, makeRun, PR_ID, RUN_ID, virtualClock } from './fixtures.js';

const POLL = 3_000;

function setup(runsSequence: ReturnType<typeof makeRun>[][], budgetMs = 240_000) {
  const api = fakeApi({ runsSequence });
  const clock = virtualClock();
  const progress: Progress[] = [];
  const opts = {
    api,
    prId: PR_ID,
    runId: RUN_ID,
    deadline: clock.now() + budgetMs,
    pollIntervalMs: POLL,
    now: clock.now,
    sleep: clock.sleep,
    onProgress: (p: Progress) => progress.push(p),
  };
  return { api, clock, progress, opts };
}

const running = () => [makeRun({ status: 'running' }), makeRun({ run_id: 'other-run', status: 'done' })];

describe('waitForRun', () => {
  it('returns done after N polls, sleeping the poll interval and reporting progress between polls', async () => {
    const { api, clock, progress, opts } = setup([running(), running(), [makeRun({ status: 'done', score: 77 })]]);

    const out = await waitForRun(opts);

    expect(out.status).toBe('done');
    expect(out.status === 'done' && out.run.score).toBe(77);
    expect(api.listRuns).toHaveBeenCalledTimes(3);
    expect(api.listRuns).toHaveBeenCalledWith(PR_ID, undefined);
    expect(clock.sleeps).toEqual([POLL, POLL]);
    expect(progress.map((p) => p.progress)).toEqual([1, 2]);
    expect(progress[1]!.message).toBe('Review running for 3 s');
  });

  it('looks at its own run only — another finished run on the PR does not end the wait', async () => {
    const { opts, api } = setup([running(), [makeRun({ status: 'done' })]]);
    await waitForRun(opts);
    expect(api.listRuns).toHaveBeenCalledTimes(2);
  });

  it.each(['failed', 'cancelled'] as const)('returns %s with the run row', async (status) => {
    const { opts } = setup([[makeRun({ status, error: 'boom' })]]);
    const out = await waitForRun(opts);
    expect(out.status).toBe(status);
    expect(out.status === status && 'run' in out && out.run.error).toBe('boom');
  });

  it('a row with status null is treated as still starting and polled again', async () => {
    const { opts, api } = setup([[makeRun({ status: null })], [makeRun({ status: 'done' })]]);
    const out = await waitForRun(opts);
    expect(out.status).toBe('done');
    expect(api.listRuns).toHaveBeenCalledTimes(2);
  });

  it('a run missing from the list throws run_not_found pointing at run_agent_on_pr', async () => {
    const { opts } = setup([[makeRun({ run_id: 'someone-else' })]]);
    const err = await waitForRun(opts).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ToolError);
    expect((err as ToolError).code).toBe('run_not_found');
    expect((err as ToolError).message).toContain('run_agent_on_pr');
  });

  it('stops at the deadline: the last sleep is capped to the remaining budget, then status running', async () => {
    const { opts, clock, api } = setup([running()], 10_000);
    const out = await waitForRun(opts);
    expect(out).toEqual({ status: 'running', aborted: false });
    expect(clock.sleeps).toEqual([3_000, 3_000, 3_000, 1_000]);
    expect(clock.now()).toBe(opts.deadline);
    expect(api.listRuns).toHaveBeenCalledTimes(5); // one last look at the deadline
  });

  it('an already-aborted signal returns running/aborted without polling', async () => {
    const { opts, api } = setup([running()]);
    const ac = new AbortController();
    ac.abort();
    const out = await waitForRun({ ...opts, signal: ac.signal });
    expect(out).toEqual({ status: 'running', aborted: true });
    expect(api.listRuns).not.toHaveBeenCalled();
  });

  it('an abort during sleep ends the wait on the next turn; an abort that makes listRuns reject is not an error', async () => {
    const ac = new AbortController();
    const { opts, api } = setup([running()]);
    const out = await waitForRun({
      ...opts,
      signal: ac.signal,
      sleep: async () => {
        ac.abort();
      },
    });
    expect(out).toEqual({ status: 'running', aborted: true });
    expect(api.listRuns).toHaveBeenCalledTimes(1);

    const ac2 = new AbortController();
    const rejecting = setup([running()]);
    rejecting.api.listRuns.mockImplementationOnce(async () => {
      ac2.abort();
      throw new ToolError('aborted', 'cancelled');
    });
    await expect(waitForRun({ ...rejecting.opts, signal: ac2.signal })).resolves.toEqual({
      status: 'running',
      aborted: true,
    });
  });

  it('a listRuns failure without an abort propagates', async () => {
    const { opts, api } = setup([running()]);
    api.listRuns.mockRejectedValueOnce(new ToolError('api_down', 'down'));
    await expect(waitForRun(opts)).rejects.toMatchObject({ code: 'api_down' });
  });

  it('onProgress is optional', async () => {
    const { opts } = setup([running(), [makeRun({ status: 'done' })]]);
    const { onProgress: _drop, ...rest } = opts;
    await expect(waitForRun(rest)).resolves.toMatchObject({ status: 'done' });
  });
});
