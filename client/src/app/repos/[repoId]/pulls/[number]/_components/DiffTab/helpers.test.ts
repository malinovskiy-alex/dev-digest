import { describe, it, expect } from "vitest";
import type { FindingRecord, PrFile, ReviewRecord, SmartDiff } from "@devdigest/shared";
import { diffFocusHref, diffTotals, inlineFindings, parseDiffFocus, parsePositiveInt, resolveGroups, tabHref } from "./helpers";

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

// ---- L05 PR Brief: the focus URL (plan steps 20, 25g; R-53, R-55, R-59, R-77, D-32, F-03) ----

describe("diffFocusHref / tabHref / parseDiffFocus", () => {
  const base = "/repos/r1/pulls/7";

  it("R-53 — a focus opens ?tab=diff&file=<path>&line=<line>, keeping other params", () => {
    const href = diffFocusHref(base, new URLSearchParams("tab=overview&trace=run-1"), "src/a b.ts", 61);
    const [path, query] = href.split("?");
    expect(path).toBe(base);
    const sp = new URLSearchParams(query);
    expect(sp.get("tab")).toBe("diff");
    expect(sp.get("file")).toBe("src/a b.ts");
    expect(sp.get("line")).toBe("61");
    expect(sp.get("trace")).toBe("run-1");
  });

  it("R-55 — a focus without a line drops any old line", () => {
    const sp = new URLSearchParams(diffFocusHref(base, new URLSearchParams("tab=diff&file=x.ts&line=9"), "y.ts", null).split("?")[1]);
    expect(sp.get("file")).toBe("y.ts");
    expect(sp.has("line")).toBe(false);
  });

  it("R-77, D-32 — a tab click sets the tab and drops file and line", () => {
    const sp = new URLSearchParams(tabHref(base, new URLSearchParams("tab=diff&file=x.ts&line=9&trace=t"), "overview").split("?")[1]);
    expect(sp.get("tab")).toBe("overview");
    expect(sp.has("file")).toBe(false);
    expect(sp.has("line")).toBe(false);
    expect(sp.get("trace")).toBe("t");
  });

  it("R-59 — a reloaded URL gives the same focus back; a bad line becomes null; no file → no focus", () => {
    const href = diffFocusHref(base, new URLSearchParams(), "src/x.ts", 12);
    expect(parseDiffFocus(new URLSearchParams(href.split("?")[1]))).toEqual({ path: "src/x.ts", line: 12 });
    for (const bad of ["0", "-3", "2.5", "abc", ""]) {
      expect(parseDiffFocus(new URLSearchParams({ file: "a.ts", line: bad }))).toEqual({ path: "a.ts", line: null });
    }
    expect(parseDiffFocus(new URLSearchParams("line=4"))).toBeNull();
    expect(parsePositiveInt("1")).toBe(1);
  });
});
