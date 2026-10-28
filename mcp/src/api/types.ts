/**
 * The shapes the DevDigest API returns, as the MCP server sees them.
 *
 * Types only. `@devdigest/shared` is imported with `import type` and nothing
 * else: a runtime import of the vendored barrel breaks the bundle
 * (server/INSIGHTS.md, "a runtime import from vendor/shared breaks the whole
 * client").
 */
import type {
  Agent,
  ApiErrorBody,
  BlastRadius,
  ConventionsView,
  Finding,
  PrMeta,
  Repo,
  RunSummary,
} from '@devdigest/shared';

export type { Agent, ApiErrorBody, BlastRadius, ConventionsView, PrMeta, Repo, RunSummary };

/**
 * One finding of `GET /pulls/:id/reviews`.
 * Hand-mirrored from the server-local `ReviewDtoFinding`
 * (server/src/modules/reviews/helpers.ts:12-16) — the shape the server actually
 * emits. Shared's `FindingRecord` (contracts/review-api.ts) is unused by the
 * server, so it is not the source of truth.
 */
export interface ApiReviewFinding extends Finding {
  review_id: string;
  accepted_at: string | null;
  dismissed_at: string | null;
}

/**
 * One element of `GET /pulls/:id/reviews` (newest first).
 * Hand-mirrored from the server-local `ReviewDto`
 * (server/src/modules/reviews/helpers.ts:18-32) — keep the two in step.
 */
export interface ApiReview {
  id: string;
  pr_id: string;
  agent_id: string | null;
  run_id: string | null;
  agent_name?: string | null;
  kind: 'summary' | 'review';
  verdict: string | null;
  summary: string | null;
  score: number | null;
  model: string | null;
  grounding?: string | null;
  created_at: string;
  findings: ApiReviewFinding[];
}

/** One element of `GET /pulls/:id/runs/active` (reviews/repository/run.repo.ts:10-37). */
export interface ActiveRun {
  run_id: string;
  agent_id: string | null;
  agent_name: string | null;
  ran_at: string | null;
}

/** `POST /pulls/:id/review {agentId}` (reviews/routes.ts:42-55, service.ts:104-139). */
export interface StartRunResponse {
  pr_id: string;
  runs: { run_id: string; agent_id: string; agent_name: string }[];
  reviews: ApiReview[];
}

/** `agent_runs.status` values; `RunSummary.status` is a plain nullable string. */
export type RunStatus = 'running' | 'done' | 'failed' | 'cancelled';
