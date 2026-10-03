import { describe, it, expect } from "vitest";
import type { FindingRecord, PrFile, ReviewRecord, SmartDiff } from "@devdigest/shared";
import { diffTotals, inlineFindings, resolveGroups } from "./helpers";

const finding = (id: string): FindingRecord => ({
  id,
  severity: "WARNING",
  category: "bug",
  title: id,
  file: "src/a.ts",
  start_line: 1,
  end_line: 1,
  rationale: "r",
  suggestion: null,
  confidence: 0.9,
  kind: "finding",
  trifecta_components: null,
  evidence: null,
  review_id: "r",
  accepted_at: null,
  dismissed_at: null,
});

const review = (id: string, kind: ReviewRecord["kind"], findings: FindingRecord[]): ReviewRecord => ({
  id,
  pr_id: "pr1",
  agent_id: null,
  run_id: null,
  kind,
  verdict: null,
  summary: null,
  score: null,
  model: null,
  created_at: "2026-01-01T00:00:00Z",
  findings,
});

const file = (path: string, additions = 1, deletions = 0): PrFile => ({ path, additions, deletions, patch: null });
const sdFile = (path: string) => ({ path, additions: 1, deletions: 0, finding_lines: [] });
const split = { too_big: false, total_lines: 0, proposed_splits: [] };

describe("inlineFindings", () => {
  const smartDiffFor = (review_id: string | null): SmartDiff => ({
    review_id,
    groups: [],
    split_suggestion: split,
  });

  it("takes the review the server named in the smart diff, not the client's own pick", () => {
    const fromReview = [finding("keep")];
    const reviews = [
      review("newest-summary", "summary", [finding("summary-only")]),
      review("newer", "review", fromReview),
      review("older", "review", [finding("old")]),
    ];
    expect(inlineFindings(reviews, smartDiffFor("newer"))).toBe(fromReview);
    // the server is authoritative even when its pick is not the first review-kind one
    expect(inlineFindings(reviews, smartDiffFor("older"))[0]!.id).toBe("old");
  });

  it("returns [] until the smart diff resolves, with no review, or an unknown id", () => {
    const reviews = [review("r1", "review", [finding("x")])];
    expect(inlineFindings(reviews, undefined)).toEqual([]);
    expect(inlineFindings(reviews, smartDiffFor(null))).toEqual([]);
    expect(inlineFindings(reviews, smartDiffFor("not-loaded-yet"))).toEqual([]);
    expect(inlineFindings(undefined, smartDiffFor("r1"))).toEqual([]);
  });

  it("falls back to the newest review-kind review when the smart diff failed (D-9)", () => {
    const fromReview = [finding("keep")];
    const reviews = [
      review("newest-summary", "summary", [finding("summary-only")]),
      review("newer", "review", fromReview),
      review("older", "review", [finding("old")]),
    ];
    expect(inlineFindings(reviews, undefined, true)).toBe(fromReview);
    expect(inlineFindings(undefined, undefined, true)).toEqual([]);
  });
});

describe("resolveGroups", () => {
  const files = [file("README.md"), file("src/b.ts"), file("src/a.ts"), file("src/a.test.ts")];

  it("maps groups onto PrFiles, sorted by GitHub order within a group", () => {
    const sd: SmartDiff = {
      review_id: null,
      groups: [
        { role: "core", files: [sdFile("src/a.ts"), sdFile("src/b.ts")] },
        { role: "tests", files: [sdFile("src/a.test.ts")] },
        { role: "docs", files: [sdFile("README.md"), sdFile("gone.md")] },
      ],
      split_suggestion: split,
    };
    const resolved = resolveGroups(sd, files)!;
    expect(resolved.map((g) => g.group.role)).toEqual(["core", "tests", "docs"]);
    // GitHub order puts src/b.ts before src/a.ts
    expect(resolved[0]!.files.map((f) => f.path)).toEqual(["src/b.ts", "src/a.ts"]);
    // a smart-diff path the PR does not have is dropped
    expect(resolved[2]!.files.map((f) => f.path)).toEqual(["README.md"]);
  });

  it("returns null when a PR file is in no group, or there is no smart diff yet", () => {
    const sd: SmartDiff = {
      review_id: null,
      groups: [{ role: "core", files: [sdFile("src/a.ts"), sdFile("src/b.ts")] }],
      split_suggestion: split,
    };
    expect(resolveGroups(sd, files)).toBeNull();
    expect(resolveGroups(undefined, files)).toBeNull();
  });
});

describe("diffTotals", () => {
  it("counts files and sums additions and deletions", () => {
    expect(diffTotals([file("a", 10, 2), file("b", 5, 0), file("c", 0, 7)])).toEqual({
      files: 3,
      additions: 15,
      deletions: 9,
    });
    expect(diffTotals([])).toEqual({ files: 0, additions: 0, deletions: 0 });
  });
});
