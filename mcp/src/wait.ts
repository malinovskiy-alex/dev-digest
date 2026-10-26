/**
 * Ring 2 — wait for one agent run to leave `running`, by polling
 * `GET /pulls/:id/runs` (the DB is the source of truth; the SSE bus is
 * in-memory and would hang after an API restart — spec D5).
 *
 * Clock and sleep are injected so tests run instantly. An aborted signal stops
 * the WATCHING, never the run itself.
 */
import type { DevDigestApi } from './api/port.js';
import type { RunSummary } from './api/types.js';
import { ToolError } from './errors.js';
import { clean, RUN_ID_MAX } from './format.js';

export interface Progress {
  progress: number;
  total?: number;
  message: string;
}

export type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

export interface WaitOptions {
  api: DevDigestApi;
  prId: string;
  runId: string;
  /** Absolute time (per `now`) after which waiting stops — the tool's budget. */
  deadline: number;
  pollIntervalMs: number;
  now: () => number;
  sleep: Sleep;
  signal?: AbortSignal;
  onProgress?: (p: Progress) => void;
}

export type WaitOutcome =
  | { status: 'done' | 'failed' | 'cancelled'; run: RunSummary }
  /** Budget spent, or the caller went away: the run may still be going. */
  | { status: 'running'; aborted: boolean };

const TERMINAL = new Set(['done', 'failed', 'cancelled']);

export async function waitForRun(opts: WaitOptions): Promise<WaitOutcome> {
  const started = opts.now();
  let polls = 0;
  for (;;) {
    if (opts.signal?.aborted) return { status: 'running', aborted: true };

    let runs: RunSummary[];
    try {
      runs = await opts.api.listRuns(opts.prId, opts.signal);
    } catch (err) {
      if (opts.signal?.aborted) return { status: 'running', aborted: true };
      throw err;
    }
    const run = runs.find((r) => r.run_id === opts.runId);
    if (!run) {
      throw new ToolError(
        'run_not_found',
        `Run ${clean(opts.runId, RUN_ID_MAX)} is no longer listed on this PR (it may have been deleted). Start a new one with run_agent_on_pr.`,
      );
    }
    if (run.status !== null && TERMINAL.has(run.status)) {
      return { status: run.status as 'done' | 'failed' | 'cancelled', run };
    }

    const remaining = opts.deadline - opts.now();
    if (remaining <= 0) return { status: 'running', aborted: false };

    polls += 1;
    opts.onProgress?.({
      progress: polls,
      message: `Review running for ${Math.round((opts.now() - started) / 1000)} s`,
    });

    await opts.sleep(Math.min(opts.pollIntervalMs, remaining), opts.signal);
  }
}

/** Default `Sleep`: a timer that resolves early when the signal aborts. */
export const realSleep: Sleep = (ms, signal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
    signal?.addEventListener('abort', done, { once: true });
  });
