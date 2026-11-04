/** Pure state of the PR Brief's verdict banner (R-78 … R-105). No React, no fetch. */
import type { ReviewRecord, RunSummary, Verdict } from "@devdigest/shared";
import { shortSha } from "@/lib/short-sha";
import { verdictCounts } from "@/lib/verdict-counts";

/** A run status that leaves the previous review on screen with a "failed" note (R-104). */
const FAILED_RUN_STATUSES: readonly string[] = ["failed", "cancelled"];

export type ReviewBannerState =
  | { kind: "hidden" }
  | { kind: "none"; running: boolean }
  | {
      kind: "review";
      review: ReviewRecord;
      /** The latest review's verdict, never null here (BA-3). */
      verdict: Verdict;
      findingsCount: number;
      blockers: number;
      running: boolean;
      newestRunFailed: boolean;
      /** Short SHA of the reviewed commit when it is not the PR's head (R-94), else null. */
      staleSha: string | null;
    };

/** The newest `kind === "review"` row by `created_at`, or null (R-82). */
export function latestReview(reviews: readonly ReviewRecord[]): ReviewRecord | null {
  let best: ReviewRecord | null = null;
  let bestAt = -Infinity;
  for (const r of reviews) {
    if (r.kind !== "review") continue;
    const at = Date.parse(r.created_at);
    if (best == null || at > bestAt) {
      best = r;
      bestAt = at;
    }
  }
  return best;
}

/** The run with the greatest `ran_at`, any agent; runs without `ran_at` are ignored (BA-4). */
export function newestRun(runs: readonly RunSummary[]): RunSummary | null {
  let best: RunSummary | null = null;
  let bestAt = -Infinity;
  for (const r of runs) {
    if (r.ran_at == null) continue;
    const at = Date.parse(r.ran_at);
    if (Number.isNaN(at)) continue;
    if (best == null || at > bestAt) {
      best = r;
      bestAt = at;
    }
  }
  return best;
}

export function reviewBannerState({
  reviewsStatus,
  reviews,
  activeRunCount,
  runs,
  headSha,
  lastReviewedSha,
}: {
  reviewsStatus: "pending" | "error" | "success";
  reviews: readonly ReviewRecord[] | undefined;
  activeRunCount: number;
  runs: readonly RunSummary[] | undefined;
  headSha: string;
  lastReviewedSha: string | null;
}): ReviewBannerState {
  // R-99, BA-5: loading or a failed read (even over cached data) shows nothing.
  if (reviewsStatus !== "success" || !reviews) return { kind: "hidden" };
  const running = activeRunCount > 0;
  const review = latestReview(reviews);
  if (!review) return { kind: "none", running };
  // BA-3: a review row with no verdict is not shown, as on Agent runs.
  if (review.verdict == null) return { kind: "hidden" };
  const { findingsCount, blockers } = verdictCounts(review.findings);
  const newest = newestRun(runs ?? []);
  const newestRunFailed = !running && newest != null && FAILED_RUN_STATUSES.includes(newest.status ?? "");
  const staleSha = lastReviewedSha && lastReviewedSha !== headSha ? shortSha(lastReviewedSha) : null;
  return { kind: "review", review, verdict: review.verdict, findingsCount, blockers, running, newestRunFailed, staleSha };
}
