import { describe, it, expect } from "vitest";
import type { FindingRecord } from "@devdigest/shared";
import { findingKey, partitionFindings, topSeverity } from "./findings";
import { keysForLine } from "./comments";
import { parsePatch } from "./helpers";

function finding(o: Partial<FindingRecord> & { id: string }): FindingRecord {
  return {
    severity: "WARNING",
    category: "bug",
    title: "t",
    file: "src/a.ts",
    start_line: 2,
    end_line: 2,
    rationale: "r",
    suggestion: null,
    confidence: 0.9,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...o,
  };
}

// new lines 1–3; old line 2 is deleted, so LEFT:2 exists but RIGHT:2 is the added line
const PATCH = "@@ -1,3 +1,3 @@\n const a = 1;\n-const b = 2;\n+const b = 3;\n const c = 4;\n-const d = 5;";
const renderedKeys = new Set(parsePatch(PATCH).flatMap(keysForLine));

describe("findings helpers", () => {
  it("keys a finding on its RIGHT start line and splits anchored from unanchored", () => {
    const onLine = finding({ id: "a", start_line: 2 });
    const offPatch = finding({ id: "b", start_line: 40 });
    expect(findingKey(onLine)).toBe("RIGHT:2");

    const { matched, unanchored } = partitionFindings([onLine, offPatch], renderedKeys);
    expect(matched.get("RIGHT:2")).toEqual([onLine]);
    expect(unanchored).toEqual([offPatch]);
  });

  it("keeps several findings on one line together, in input order", () => {
    const first = finding({ id: "a", start_line: 3 });
    const second = finding({ id: "b", start_line: 3, severity: "CRITICAL" });
    const { matched, unanchored } = partitionFindings([first, second], renderedKeys);
    expect(matched.get("RIGHT:3")).toEqual([first, second]);
    expect(unanchored).toEqual([]);
  });

  it("treats a finding on a deleted-only line as unanchored", () => {
    // old line 4 (`const d = 5;`) is deleted: LEFT:4 is rendered, RIGHT:4 is not
    expect(renderedKeys.has("LEFT:4")).toBe(true);
    expect(renderedKeys.has("RIGHT:4")).toBe(false);
    const onDeleted = finding({ id: "d", start_line: 4 });
    const { matched, unanchored } = partitionFindings([onDeleted], renderedKeys);
    expect(matched.size).toBe(0);
    expect(unanchored).toEqual([onDeleted]);
  });

  it("topSeverity picks CRITICAL over WARNING over SUGGESTION, null when empty", () => {
    expect(topSeverity([])).toBeNull();
    expect(topSeverity([finding({ id: "s", severity: "SUGGESTION" })])).toBe("SUGGESTION");
    expect(
      topSeverity([
        finding({ id: "s", severity: "SUGGESTION" }),
        finding({ id: "w", severity: "WARNING" }),
      ]),
    ).toBe("WARNING");
    expect(
      topSeverity([
        finding({ id: "w", severity: "WARNING" }),
        finding({ id: "c", severity: "CRITICAL" }),
        finding({ id: "s", severity: "SUGGESTION" }),
      ]),
    ).toBe("CRITICAL");
  });
});
