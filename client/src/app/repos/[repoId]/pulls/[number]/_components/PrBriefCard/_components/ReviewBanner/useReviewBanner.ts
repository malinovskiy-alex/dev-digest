/* useReviewBanner — the data of the PR Brief's verdict banner (BD-8). Composes
   the existing review / run queries (all DB reads, R-85: no model, no GitHub)
   and refreshes them when the PR's last active run ends (R-88). No new query key. */
"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePrActiveRuns, usePrReviews, usePrRuns, useWhenActiveRunsEnd } from "@/lib/hooks/reviews";
import { reviewBannerState, type ReviewBannerState } from "./helpers";

export function useReviewBanner(prId: string, headSha: string, lastReviewedSha: string | null): ReviewBannerState {
  const qc = useQueryClient();
  const reviews = usePrReviews(prId);
  const active = usePrActiveRuns(prId);
  const runs = usePrRuns(prId);

  // R-88: a finished run wrote a new review (or failed) — re-read both. The
  // ["reviews", prId] prefix also refreshes the Smart Diff counts. The PR read
  // carries `last_reviewed_sha`, so it is re-read too, or the stale badge (R-94)
  // would outlive the run that made the review current.
  useWhenActiveRunsEnd(prId, () => {
    void qc.invalidateQueries({ queryKey: ["reviews", prId] });
    void qc.invalidateQueries({ queryKey: ["pr-runs", prId] });
    void qc.invalidateQueries({ queryKey: ["pull", prId] });
  });

  return reviewBannerState({
    reviewsStatus: reviews.status,
    reviews: reviews.data,
    activeRunCount: active.data?.length ?? 0,
    runs: runs.data,
    headSha,
    lastReviewedSha,
  });
}
