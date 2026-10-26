/**
 * pr-history limits. Each bounds one request of `GET /pulls/:id/history`.
 */

/** Newest merged PRs compared per request; ≤ the 50 PRs the PR-list sync keeps per repo. */
export const PRIOR_PR_CANDIDATES = 30;

/** GitHub `listPullFiles` calls per request for uncached candidates; bounds latency and rate-limit use. */
export const PRIOR_PR_FETCH_BUDGET = 8;

/** How many of those GitHub calls run at once. */
export const PRIOR_PR_FETCH_CONCURRENCY = 4;
