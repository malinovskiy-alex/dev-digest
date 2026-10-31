import { describe, it, expect } from "vitest";
import type { ContextDoc, ContextDocLink, InheritedContextDoc } from "@devdigest/shared";
import {
  attachedCount,
  buildDocRows,
  matchesPathFilter,
  middleTruncate,
  moveRow,
  promptTokenTotal,
  sourceCount,
  toEntries,
  toggleRow,
} from "./context-docs";

function doc(path: string, tokens = 10): ContextDoc {
  const slash = path.lastIndexOf("/");
  return {
    path,
    name: path.slice(slash + 1),
    folder: slash >= 0 ? path.slice(0, slash) : "",
    category: slash >= 0 ? path.slice(0, path.indexOf("/")) : "root",
    chars: tokens * 4,
    approx_tokens: tokens,
    truncated: false,
    used_by: 0,
  };
}

const DOCS = [doc("docs/b.md", 10), doc("docs/a.md", 20), doc("specs/c.md", 30), doc("specs/d.md", 40)];

describe("buildDocRows", () => {
  it("orders stored rows by `order`, then inherited, then the rest alphabetically; each path once", () => {
    const attached: ContextDocLink[] = [
      { path: "specs/c.md", order: 1, enabled: false },
      { path: "docs/gone.md", order: 2, enabled: true },
      { path: "docs/b.md", order: 0, enabled: true },
    ];
    const inherited: InheritedContextDoc[] = [
      { path: "specs/d.md", skill_id: "s1", skill_name: "Security" },
      { path: "docs/b.md", skill_id: "s1", skill_name: "Security" },
    ];
    const rows = buildDocRows(DOCS, attached, inherited);
    expect(rows.map((r) => [r.path, r.kind, r.stored, r.enabled, r.missing])).toEqual([
      ["docs/b.md", "direct", true, true, false],
      ["specs/c.md", "direct", true, false, false],
      ["docs/gone.md", "direct", true, true, true],
      ["specs/d.md", "inherited", false, true, false],
      ["docs/a.md", "direct", false, false, false],
    ]);
    expect(rows[0]!.viaSkills).toEqual(["Security"]);
  });
});

describe("toggle / move / entries", () => {
  const base = () =>
    buildDocRows(DOCS, [
      { path: "docs/b.md", order: 0, enabled: true },
      { path: "specs/c.md", order: 1, enabled: true },
    ]);

  it("unchecking a stored row parks it in place; checking an unstored doc appends it to the stored block", () => {
    let rows = toggleRow(base(), "docs/b.md");
    expect(toEntries(rows)).toEqual([
      { path: "docs/b.md", enabled: false },
      { path: "specs/c.md", enabled: true },
    ]);
    rows = toggleRow(rows, "specs/d.md");
    expect(toEntries(rows)).toEqual([
      { path: "docs/b.md", enabled: false },
      { path: "specs/c.md", enabled: true },
      { path: "specs/d.md", enabled: true },
    ]);
  });

  it("a save keeps every stored row, missing ones included; only unchecking a checked missing row removes it (F-19)", () => {
    const rows = buildDocRows(DOCS, [
      { path: "docs/gone.md", order: 0, enabled: true },
      { path: "docs/gone2.md", order: 1, enabled: false },
      { path: "docs/b.md", order: 2, enabled: true },
    ]);
    // a parked row absent from this repo's listing is still written, in place
    expect(toEntries(rows)).toEqual([
      { path: "docs/gone.md", enabled: true },
      { path: "docs/gone2.md", enabled: false },
      { path: "docs/b.md", enabled: true },
    ]);
    // an explicit uncheck of the checked missing row detaches it
    expect(toEntries(toggleRow(rows, "docs/gone.md"))).toEqual([
      { path: "docs/gone2.md", enabled: false },
      { path: "docs/b.md", enabled: true },
    ]);
    // checking the parked missing row keeps it (now checked), it is not removed
    expect(toEntries(toggleRow(rows, "docs/gone2.md"))).toEqual([
      { path: "docs/gone.md", enabled: true },
      { path: "docs/gone2.md", enabled: true },
      { path: "docs/b.md", enabled: true },
    ]);
  });

  it("an inherited row cannot be toggled", () => {
    const rows = buildDocRows(DOCS, [], [{ path: "docs/a.md", skill_id: "s", skill_name: "S" }]);
    expect(toggleRow(rows, "docs/a.md")).toBe(rows);
  });

  it("moves only inside the stored block", () => {
    const rows = base();
    expect(moveRow(rows, 1, 0).map((r) => r.path).slice(0, 2)).toEqual(["specs/c.md", "docs/b.md"]);
    // clamped to the block's end, never into the unstored docs
    expect(moveRow(rows, 0, 3).map((r) => r.path).slice(0, 2)).toEqual(["specs/c.md", "docs/b.md"]);
    // an unstored row does not move
    expect(moveRow(rows, 2, 0)).toBe(rows);
  });
});

describe("counters", () => {
  it("X of Y attached and the token total come from the full rows, each path once, missing = 0", () => {
    const rows = buildDocRows(
      DOCS,
      [
        { path: "docs/b.md", order: 0, enabled: true }, // 10
        { path: "docs/a.md", order: 1, enabled: false }, // parked → not in prompt
        { path: "docs/gone.md", order: 2, enabled: true }, // missing → 0, not attached
      ],
      [
        { path: "specs/c.md", skill_id: "s", skill_name: "S" }, // 30
        { path: "docs/b.md", skill_id: "s", skill_name: "S" }, // dup of a checked row
      ],
    );
    expect(attachedCount(rows)).toBe(1);
    expect(sourceCount(rows)).toBe(4);
    expect(promptTokenTotal(rows)).toBe(40);
  });
});

describe("matchesPathFilter", () => {
  it("is a case-insensitive substring match; blank matches everything", () => {
    expect(matchesPathFilter("docs/Security.md", "SECUR")).toBe(true);
    expect(matchesPathFilter("docs/a.md", "specs")).toBe(false);
    expect(matchesPathFilter("docs/a.md", "  ")).toBe(true);
  });
});

describe("middleTruncate", () => {
  it("keeps short paths, otherwise keeps the start and the file name around one ellipsis", () => {
    expect(middleTruncate("docs/a.md", 20)).toBe("docs/a.md");
    const out = middleTruncate("specs/very/deep/folder/structure/feature.md", 24);
    expect(out).toHaveLength(24);
    expect(out).toBe("specs/very/d…/feature.md");
    expect(out.endsWith("/feature.md")).toBe(true);
  });

  it("falls back to the tail when the file name alone does not fit", () => {
    expect(middleTruncate("docs/an-extremely-long-file-name.md", 10)).toBe("…e-name.md");
  });
});
