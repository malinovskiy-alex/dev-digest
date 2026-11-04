/**
 * ReviewBanner helpers — the pure state of the PR Brief's verdict banner.
 * Expected values come from R-79, R-82, R-84, R-94, R-99, R-101…R-104 and the
 * plan's BA-3 (null verdict → hidden), BA-4 (newest run = greatest ran_at, any
 * agent) and BA-5 (an errored read hides even over cached data).
 */
import { describe, it, expect } from "vitest";
import type { FindingRecord, ReviewRecord, RunSummary } from "@devdigest/shared";
import { latestReview, newestRun, reviewBannerState } from "./helpers";

const HEAD = "abc1234def5678";

const finding = (severity: FindingRecord["severity"], dismissed_at: string | null = null): FindingRecord => ({
  id: `${severity}-${dismissed_at ?? "open"}`,
  severity,
  category: "bug",
  title: "t",
  file: "a.ts",
  start_line: 1,
  end_line: 1,
  rationale: "r",
  confidence: 1,
  review_id: "r",
  accepted_at: null,
  dismissed_at,
});

const review = (o: Partial<ReviewRecord> = {}): ReviewRecord => ({
  id: "rev",
  pr_id: "pr-1",
  agent_id: "a",
  run_id: "run",
  agent_name: "Security Reviewer",
  kind: "review",
  verdict: "request_changes",
  summary: "Review text.",
  score: 61,
  model: "m",
  created_at: "2026-11-01T11:00:00.000Z",
  findings: [finding("CRITICAL"), finding("CRITICAL", "2026-11-01T11:10:00.000Z"), finding("WARNING")],
  ...o,
});

const run = (status: string | null, ran_at: string | null, run_id = `run-${status}-${ran_at}`): RunSummary => ({
  run_id,
  agent_id: "a",
  agent_name: "x",
  provider: null,
  model: null,
  status,
  error: null,
  duration_ms: null,
  tokens_in: null,
  tokens_out: null,
  cost_usd: null,
  findings_count: null,
  grounding: null,
  ran_at,
  score: null,
  blockers: null,
});

const base = {
  reviewsStatus: "success" as const,
  reviews: [review()],
  activeRunCount: 0,
  runs: [] as RunSummary[],
  headSha: HEAD,
  lastReviewedSha: null as string | null,
};

describe("latestReview (R-82)", () => {
  it("picks the newest kind 'review' by created_at, ignoring newer 'summary' rows and input order", () => {
    const old = review({ id: "old", created_at: "2026-10-30T09:00:00.000Z" });
    const newest = review({ id: "new", created_at: "2026-11-01T11:00:00.000Z" });
    const summary = review({ id: "sum", kind: "summary", created_at: "2026-11-01T12:00:00.000Z" });
    expect(latestReview([summary, newest, old])?.id).toBe("new");
    expect(latestReview([old, summary, newest])?.id).toBe("new");
  });

  it("compares instants, not strings (offsets)", () => {
    // 10:00-05:00 is 15:00Z: later than 12:00Z although it sorts lower as a string
    const a = review({ id: "a", created_at: "2026-11-01T12:00:00.000Z" });
    const b = review({ id: "b", created_at: "2026-11-01T10:00:00.000-05:00" });
    expect(latestReview([a, b])?.id).toBe("b");
  });

  it("null with no review rows (only summaries, or nothing)", () => {
    expect(latestReview([])).toBeNull();
    expect(latestReview([review({ kind: "summary" })])).toBeNull();
  });
});

describe("newestRun (BA-4)", () => {
  it("the greatest ran_at of any agent; runs with no ran_at are ignored", () => {
    const runs = [
      run("done", "2026-11-01T11:00:00.000Z", "a"),
      run("failed", "2026-11-01T11:40:00.000Z", "b"),
      run("cancelled", null, "c"),
      run("done", "2026-11-01T10:00:00.000Z", "d"),
    ];
    expect(newestRun(runs)?.run_id).toBe("b");
  });

  it("null when nothing has a ran_at", () => {
    expect(newestRun([])).toBeNull();
    expect(newestRun([run("failed", null)])).toBeNull();
  });
});

describe("reviewBannerState", () => {
  it("R-99, BA-5 — reviews pending or errored → hidden, even with cached reviews and an active run", () => {
    expect(reviewBannerState({ ...base, reviewsStatus: "pending", reviews: undefined })).toEqual({ kind: "hidden" });
    expect(reviewBannerState({ ...base, reviewsStatus: "error", activeRunCount: 2 })).toEqual({ kind: "hidden" });
  });

  it("R-84, R-101 — no review → none, not running", () => {
    expect(reviewBannerState({ ...base, reviews: [] })).toEqual({ kind: "none", running: false });
    expect(reviewBannerState({ ...base, reviews: [review({ kind: "summary" })] })).toEqual({ kind: "none", running: false });
  });

  it("R-103 — no review with an active run → none, running", () => {
    expect(reviewBannerState({ ...base, reviews: [], activeRunCount: 1 })).toEqual({ kind: "none", running: true });
  });

  it("BA-3 — the latest review has a null verdict → hidden (not 'none', not an older review)", () => {
    const older = review({ id: "older", created_at: "2026-10-01T00:00:00.000Z" });
    expect(reviewBannerState({ ...base, reviews: [older, review({ verdict: null })] })).toEqual({ kind: "hidden" });
  });

  it("R-78, R-79 — a review: its verdict, every finding, and CRITICAL not dismissed as blockers", () => {
    const r = review();
    const s = reviewBannerState({ ...base, reviews: [r] });
    expect(s).toEqual({
      kind: "review",
      review: r,
      verdict: "request_changes",
      findingsCount: 3,
      blockers: 1,
      running: false,
      newestRunFailed: false,
      staleSha: null,
    });
  });

  it("R-102 — an active run → running", () => {
    const s = reviewBannerState({ ...base, activeRunCount: 1 });
    expect(s).toMatchObject({ kind: "review", running: true });
  });

  it.each(["failed", "cancelled"])("R-104 — the newest run %s → newestRunFailed", (status) => {
    const runs = [run("done", "2026-11-01T11:00:00.000Z"), run(status, "2026-11-01T11:40:00.000Z")];
    expect(reviewBannerState({ ...base, runs })).toMatchObject({ newestRunFailed: true });
  });

  it("R-104 — not when the newest run succeeded, is running, or there are no runs", () => {
    const failedThenDone = [run("failed", "2026-11-01T10:00:00.000Z"), run("done", "2026-11-01T11:00:00.000Z")];
    expect(reviewBannerState({ ...base, runs: failedThenDone })).toMatchObject({ newestRunFailed: false });
    expect(reviewBannerState({ ...base, runs: [run("running", "2026-11-01T11:50:00.000Z")] })).toMatchObject({
      newestRunFailed: false,
    });
    expect(reviewBannerState({ ...base, runs: [] })).toMatchObject({ newestRunFailed: false });
  });

  it("R-104 'until a newer run starts' — a failed newest run with an active run → running, not failed", () => {
    const runs = [run("failed", "2026-11-01T11:40:00.000Z")];
    expect(reviewBannerState({ ...base, runs, activeRunCount: 1 })).toMatchObject({ running: true, newestRunFailed: false });
  });

  it("R-94 — staleSha is the 7-char last-reviewed SHA when it differs from the head; null when equal or null", () => {
    expect(reviewBannerState({ ...base, lastReviewedSha: "rev1234aaaa" })).toMatchObject({ staleSha: "rev1234" });
    expect(reviewBannerState({ ...base, lastReviewedSha: HEAD })).toMatchObject({ staleSha: null });
    expect(reviewBannerState({ ...base, lastReviewedSha: null })).toMatchObject({ staleSha: null });
  });
});
