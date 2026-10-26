/**
 * Ring 2 — `get_findings`: read a review that already ran; never start one.
 *
 * Picks `kind === 'review'` only: by `run_id`, else the newest review by
 * `agent`, else the newest review. When nothing matches, the PR's runs say
 * why — still running (a result, not an error), failed, or never run.
 */
import type { ApiReview, RunSummary } from '../api/types.js';
import { ToolError } from '../errors.js';
import {
  AGENT_NAME_MAX,
  clean,
  compactReview,
  renderReviewText,
  REPO_MAX,
  RUN_ID_MAX,
  runningResult,
  type ReviewResult,
  type ToolOutput,
} from '../format.js';
import { resolveAgent, resolveRepoAndPr } from '../resolve.js';
import { runEndedError, type ToolContext, type ToolDeps } from './context.js';

export type MinSeverity = 'CRITICAL' | 'WARNING' | 'SUGGESTION';

export interface GetFindingsArgs {
  repo: string;
  pr: number;
  run_id?: string;
  agent?: string;
  min_severity?: MinSeverity;
  limit?: number;
}

function newestFirst(a: ApiReview, b: ApiReview): number {
  return b.created_at.localeCompare(a.created_at);
}

export async function getFindings(
  deps: Pick<ToolDeps, 'api'>,
  args: GetFindingsArgs,
  ctx: ToolContext = {},
): Promise<ToolOutput<ReviewResult>> {
  const { api } = deps;
  const { signal } = ctx;
  const runIdArg = args.run_id?.trim() || undefined;
  const agentArg = args.agent?.trim() || undefined;

  const [{ repo, pr }, agent] = await Promise.all([
    resolveRepoAndPr(api, args.repo, args.pr, signal),
    agentArg ? resolveAgent(api, agentArg, signal) : Promise.resolve(undefined),
  ]);
  const where = { repo: repo.full_name, pr: pr.number };

  const reviews = (await api.listReviews(pr.id, signal)).filter((r) => r.kind === 'review').sort(newestFirst);
  const review = runIdArg
    ? reviews.find((r) => r.run_id === runIdArg)
    : agent
      ? reviews.find((r) => r.agent_id === agent.id)
      : reviews[0];

  if (review) {
    const data = compactReview(review, {
      ...where,
      ...(args.limit !== undefined ? { limit: args.limit } : {}),
      ...(args.min_severity ? { minSeverity: args.min_severity } : {}),
    });
    return { data, text: renderReviewText(data) };
  }

  // No review matched — the run history tells running from failed from never-run.
  const runs = await api.listRuns(pr.id, signal);
  const label = `${clean(repo.full_name, REPO_MAX)}#${pr.number}`;

  if (runIdArg) {
    const run = runs.find((r) => r.run_id === runIdArg);
    if (!run) {
      throw new ToolError(
        'run_not_found',
        `No run ${clean(runIdArg, RUN_ID_MAX)} on ${label}. Omit run_id to get the latest review.`,
      );
    }
    return fromRun(run, where, label);
  }

  // The newest run matching the agent filter decides: running → a result,
  // failed/cancelled → the forward-leading error (never "not reviewed", which
  // would invite a paid re-run loop), finished without a review → review_not_found.
  const newest = runs
    .filter((r) => !agent || r.agent_id === agent.id)
    .sort(newestRunFirst)[0];
  if (newest) return fromRun(newest, where, label);

  const who = agent ? ` by ${clean(agent.name, AGENT_NAME_MAX)}` : '';
  throw new ToolError(
    'not_reviewed',
    `${label} has no review${who} yet. Call run_agent_on_pr to start one.`,
  );
}

/** Newest `ran_at` first; runs without a timestamp sort last, API order kept otherwise. */
function newestRunFirst(a: RunSummary, b: RunSummary): number {
  if (a.ran_at === b.ran_at) return 0;
  if (a.ran_at === null) return 1;
  if (b.ran_at === null) return -1;
  return b.ran_at.localeCompare(a.ran_at);
}

function fromRun(
  run: RunSummary,
  where: { repo: string; pr: number },
  label: string,
): ToolOutput<ReviewResult> {
  if (run.status === 'running') {
    const data = runningResult({
      ...where,
      runId: run.run_id,
      agent: run.agent_name ?? run.agent_id,
      next: `Still running — call get_findings again later with run_id="${clean(run.run_id, RUN_ID_MAX)}".`,
    });
    return { data, text: renderReviewText(data) };
  }
  if (run.status === 'failed' || run.status === 'cancelled') throw runEndedError(run);
  throw new ToolError(
    'review_not_found',
    `Run ${clean(run.run_id, RUN_ID_MAX)} on ${label} finished but has no stored review (it may have been deleted). Call run_agent_on_pr to review again.`,
  );
}
