import { describe, it, expect } from "vitest";
import type { BlastCaller, DownstreamImpact } from "@devdigest/shared";
import { edgePath, layoutGraph, truncate } from "./helpers";
import { GRAPH_MAX_ROWS, LABEL_MAX } from "./constants";

function caller(name: string, file: string, endpoints: string[] = [], crons: string[] = []): BlastCaller {
  return { name, file, line: 1, endpoints, crons };
}

function group(symbol: string, callers: BlastCaller[]): DownstreamImpact {
  return {
    symbol,
    callers,
    endpoints_affected: [...new Set(callers.flatMap((c) => c.endpoints))],
    crons_affected: [...new Set(callers.flatMap((c) => c.crons))],
  };
}

describe("layoutGraph", () => {
  it("lays out three columns with real edges only", () => {
    const shared = caller("apiRoutes", "src/api/routes.ts", ["GET /a"], ["nightly"]);
    const layout = layoutGraph([
      group("getContext", [shared, caller("webRoutes", "src/web/routes.ts", ["GET /b"])]),
      group("slug", [shared]),
    ]);

    const kinds = (k: string) => layout.nodes.filter((n) => n.kind === k);
    expect(kinds("symbol").map((n) => n.label)).toEqual(["getContext()", "slug()"]);
    // callers deduplicated by file#name across groups
    expect(kinds("caller").map((n) => n.label)).toEqual(["apiRoutes", "webRoutes"]);
    // endpoints before crons in column 2
    const col2 = layout.nodes.filter((n) => n.kind === "endpoint" || n.kind === "cron");
    expect(col2.map((n) => `${n.kind}:${n.label}`)).toEqual(["endpoint:GET /a", "endpoint:GET /b", "cron:nightly"]);
    // columns sit at increasing x
    expect(kinds("symbol")[0]!.x).toBeLessThan(kinds("caller")[0]!.x);
    expect(kinds("caller")[0]!.x).toBeLessThan(col2[0]!.x);

    // edges: symbol → its callers; caller → ITS OWN file's targets (webRoutes never → nightly)
    const pairs = layout.edges.map((e) => `${e.from} -> ${e.to}`).sort();
    expect(pairs).toEqual(
      [
        "s:getContext -> c:src/api/routes.ts#apiRoutes",
        "s:getContext -> c:src/web/routes.ts#webRoutes",
        "s:slug -> c:src/api/routes.ts#apiRoutes",
        "c:src/api/routes.ts#apiRoutes -> e:GET /a",
        "c:src/api/routes.ts#apiRoutes -> j:nightly",
        "c:src/web/routes.ts#webRoutes -> e:GET /b",
      ].sort(),
    );
    expect(layout.edges[0]!.d).toMatch(/^M [\d.]+ [\d.]+ C /);
    expect(layout.totals).toEqual({ symbols: 2, callers: 2, endpoints: 2, crons: 1 });
    expect(layout.height).toBeGreaterThan(0);
  });

  it("folds overflow into a +N more node and drops edges to hidden nodes", () => {
    const many = Array.from({ length: GRAPH_MAX_ROWS + 3 }, (_, i) => caller(`c${i}`, `f${i}.ts`));
    const layout = layoutGraph([group("hub", many)]);
    const callers = layout.nodes.filter((n) => n.kind === "caller");
    const more = layout.nodes.find((n) => n.kind === "more");
    expect(callers).toHaveLength(GRAPH_MAX_ROWS - 1);
    expect(more?.hidden).toBe(4);
    expect(layout.edges).toHaveLength(GRAPH_MAX_ROWS - 1);
    expect(layout.edges.every((e) => e.to !== more?.id)).toBe(true);
  });

  it("truncates long labels and keeps the full text in the title", () => {
    const long = "aVeryLongFunctionNameThatDoesNotFit";
    const layout = layoutGraph([group(long, [caller("x", "x.ts")])]);
    const sym = layout.nodes.find((n) => n.kind === "symbol")!;
    expect(sym.label).toHaveLength(LABEL_MAX);
    expect(sym.label.endsWith("…")).toBe(true);
    expect(sym.title).toBe(`${long}()`);
    expect(truncate("short")).toBe("short");
  });

  it("empty input → no nodes", () => {
    const layout = layoutGraph([]);
    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
  });
});

describe("edgePath", () => {
  it("runs from the right-middle of one box to the left-middle of the next", () => {
    expect(edgePath({ x: 0, y: 0, w: 10, h: 4 }, { x: 30, y: 10, h: 4 })).toBe(
      "M 10 2 C 20 2, 20 12, 30 12",
    );
  });
});
