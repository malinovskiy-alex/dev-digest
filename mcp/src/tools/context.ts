/**
 * Ring 2 — what every tool handler receives.
 *
 * A handler is `(deps, args, ctx) → ToolOutput | throw ToolError`. It never
 * imports the SDK or the HTTP adapter: `deps.api` is the port, and `ctx`
 * carries the two things the transport supplies per call (cancellation and a
 * progress sink).
 */
import type { DevDigestApi } from '../api/port.js';
import type { RunSummary } from '../api/types.js';
import { ToolError } from '../errors.js';
import { clean, RUN_ID_MAX } from '../format.js';
import type { Progress, Sleep } from '../wait.js';

/** How much of a run's error text is quoted back to the model. */
export const RUN_ERROR_MAX = 300;

export interface ToolDeps {
  api: DevDigestApi;
  /** How long run_agent_on_pr waits for a run, from tool start (ms). */
  runWaitMs: number;
  /** Delay between two `GET /pulls/:id/runs` polls (ms). */
  pollIntervalMs: number;
  now: () => number;
  sleep: Sleep;
}

export interface ToolContext {
  /** Aborts when the client cancels the call. Stops waiting; never cancels a run. */
  signal?: AbortSignal;
  /** Set only when the client asked for progress (sent a progressToken). */
  onProgress?: (p: Progress) => void;
}

/** A run that ended without a review → the forward-leading error for it. */
export function runEndedError(run: Pick<RunSummary, 'run_id' | 'status' | 'error'>): ToolError {
  const id = clean(run.run_id, RUN_ID_MAX);
  if (run.status === 'cancelled') {
    return new ToolError(
      'run_cancelled',
      `Run ${id} was cancelled. Start a new one with run_agent_on_pr.`,
    );
  }
  if (run.error === null || run.error.trim() === '') {
    return new ToolError(
      'run_reaped',
      `Run ${id} failed without an error: the API restarted and reaped the run — run again with run_agent_on_pr.`,
    );
  }
  // The hint is decided on the full text; only the quoted part is cut.
  const keyHint = /api[\s_-]?key|unauthori[sz]ed|\b401\b/i.test(run.error)
    ? ' Add or fix the provider API key in DevDigest Settings, then run again.'
    : ' Fix the cause, then run again with run_agent_on_pr.';
  return new ToolError('run_failed', `Run ${id} failed: ${clean(run.error, RUN_ERROR_MAX)}.${keyHint}`);
}
