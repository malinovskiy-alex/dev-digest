import type { ReviewRecord } from "@devdigest/shared";

/**
 * The run the popover is about. `GET /pulls/:id/reviews` orders newest-first,
 * so the first `review` row is the latest run — the same one the list's
 * severity counts and score ring come from.
 */
export function latestReviewOf(reviews: ReviewRecord[] | undefined): ReviewRecord | undefined {
  return reviews?.find((r) => r.kind === "review");
}
