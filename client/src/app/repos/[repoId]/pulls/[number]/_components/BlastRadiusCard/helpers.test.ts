import { describe, it, expect } from "vitest";
import { resyncFinished } from "@/lib/hooks/blast";
import { indexNotice, linkSha } from "./helpers";

describe("indexNotice", () => {
  it("covers the degraded / index_status truth table", () => {
    // degraded wins and carries its own reason
    expect(indexNotice({ degraded: true, reason: "flag_off", index_status: "full" })).toEqual({
      reason: "flag_off",
    });
    expect(indexNotice({ degraded: true, reason: null, index_status: null })).toEqual({
      reason: "no_data",
    });
    // non-degraded, but the index itself is not full
    expect(indexNotice({ degraded: false, reason: null, index_status: "partial" })).toEqual({
      reason: "index_partial",
    });
    expect(indexNotice({ degraded: false, reason: null, index_status: "failed" })).toEqual({
      reason: "index_failed",
    });
    expect(indexNotice({ degraded: false, reason: null, index_status: "degraded" })).toEqual({
      reason: "no_data",
    });
    // full or unknown → no badge
    expect(indexNotice({ degraded: false, reason: null, index_status: "full" })).toBeNull();
    expect(indexNotice({ degraded: false, reason: null, index_status: null })).toBeNull();
  });
});

describe("linkSha", () => {
  it("prefers the indexed sha", () => {
    expect(linkSha({ indexed_sha: "idx" }, "head")).toBe("idx");
    expect(linkSha({ indexed_sha: null }, "head")).toBe("head");
  });
});

describe("resyncFinished", () => {
  it("waits for a captured baseline, then for updatedAt to move", () => {
    // baseline not read yet → never finished, whatever the poll says
    expect(resyncFinished(undefined, "2026-01-02")).toBe(false);
    expect(resyncFinished("2026-01-01", undefined)).toBe(false);
    expect(resyncFinished("2026-01-01", "2026-01-01")).toBe(false);
    expect(resyncFinished("2026-01-01", "2026-01-02")).toBe(true);
    // no index existed before → the first state row means done
    expect(resyncFinished(null, "2026-01-02")).toBe(true);
  });
});
