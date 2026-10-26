/**
 * Ring 2 — `run_agent_on_pr`: the whole job in one call (spec principle 1).
 *
 * repo → PR → agent → reuse an in-flight run of that agent (D11) or start one →
 * poll until it ends or the budget is spent (D5, D12) → the review it wrote.
 * A spent budget is a `running` result with the run id, not an error.
 */
import { ToolError } from '../errors.js';
import {
  AGENT_NAME_MAX,
  clean,
  compactReview,
  FINDINGS_LIMIT_DEFAULT,
  renderReviewText,
  REPO_MAX,
  RUN_ID_MAX,
  runningResult,
  type ReviewResult,
  type ToolOutput,
} from '../format.js';
import { resolveAgent, resolveRepoAndPr } from '../resolve.js';
import { waitForRun } from '../wait.js';
import { runEndedError, type ToolContext, type ToolDeps } from './context.js';

export interface RunAgentOnPrArgs {
  repo: string;
  pr: number;
  agent: string;
}

export async function runAgentOnPr(
  deps: ToolDeps,
  args: RunAgentOnPrArgs,
  ctx: ToolContext = {},
): Promise<ToolOutput<ReviewResult>> {
  const deadline = deps.now() + deps.runWaitMs; // the budget counts from tool start
  const { api } = deps;
  const { signal } = ctx;

  const [{ repo, pr }, agent] = await Promise.all([
    resolveRepoAndPr(api, args.repo, args.pr, signal),
    resolveAgent(api, args.agent, signal),
  ]);
  const where = { repo: repo.full_name, pr: pr.number };

  // D11 — a retry joins the run already in flight instead of paying for another.
  const active = await api.activeRuns(pr.id, signal);
  const inFlight = active.find((r) => r.agent_id === agent.id);
  let runId: string;
  const reused = inFlight !== undefined;
  if (inFlight) {
    runId = inFlight.run_id;
  } else {
    const started = await api.startReview(pr.id, agent.id, signal);
    if (started.runs.length === 0) {
      throw new ToolError(
        'bad_response',
        `The API accepted the review request for ${clean(repo.full_name, REPO_MAX)}#${pr.number} but returned no run. Check the PR page in the DevDigest UI before retrying.`,
      );
    }
    // Never fall back to another agent's run — we would wait on and report the wrong review.
    const run = started.runs.find((r) => r.agent_id === agent.id);
    if (!run) {
      throw new ToolError(
        'start_mismatch',
        `DevDigest started no run for agent ${clean(agent.name, AGENT_NAME_MAX)}; call list_agents and retry.`,
      );
    }
    runId = run.run_id;
  }

  const outcome = await waitForRun({
    api,
    prId: pr.id,
    runId,
    deadline,
    pollIntervalMs: deps.pollIntervalMs,
    now: deps.now,
    sleep: deps.sleep,
    ...(signal ? { signal } : {}),
    ...(ctx.onProgress ? { onProgress: ctx.onProgress } : {}),
  });

  if (outcome.status === 'running') {
    const data = runningResult({
      ...where,
      runId,
      agent: agent.name,
      reusedRun: reused,
      next: `Still running — call get_findings later with run_id="${clean(runId, RUN_ID_MAX)}".`,
    });
    return { data, text: renderReviewText(data) };
  }
  if (outcome.status !== 'done') throw runEndedError(outcome.run);

  // The review row is written before the run flips to done (run-executor.ts).
  const reviews = await api.listReviews(pr.id, signal);
  const review = reviews.find((r) => r.kind === 'review' && r.run_id === runId);
  if (!review) {
    throw new ToolError(
      'review_not_found',
      `Run ${clean(runId, RUN_ID_MAX)} finished but its review is not stored. Call get_findings with run_id="${clean(runId, RUN_ID_MAX)}" in a moment, or open the PR in the DevDigest UI.`,
    );
  }
  const data = compactReview(
    { ...review, agent_name: review.agent_name ?? agent.name },
    { ...where, limit: FINDINGS_LIMIT_DEFAULT, reusedRun: reused },
  );
  return { data, text: renderReviewText(data) };
}
