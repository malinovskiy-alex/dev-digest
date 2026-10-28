import type { DownstreamImpact } from "@devdigest/shared";
import { COL_X, GRAPH_MAX_ROWS, LABEL_MAX, NODE_H, NODE_W, PAD, ROW_GAP, VIEW_W } from "./constants";

/* layoutGraph — pure placement of the blast graph (no React, no DOM).
   Three fixed columns: changed symbol → caller function → endpoint / cron.
   Edges are only what the data says: symbol → each of its callers, and caller →
   the endpoints / crons declared in THAT caller's file (D13). Nothing is
   inferred from a group's union. */

export type GraphNodeKind = "symbol" | "caller" | "endpoint" | "cron" | "more";

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  /** Display text, truncated to LABEL_MAX. Empty for a `more` node (the component words it). */
  label: string;
  /** Full text for the tooltip. */
  title: string;
  /** For a `more` node: how many rows it stands for. */
  hidden: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  d: string;
}

export interface GraphLayout {
  width: number;
  height: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Uncapped totals, for the SVG description and the legend. */
  totals: { symbols: number; callers: number; endpoints: number; crons: number };
}

type Draft = Pick<GraphNode, "id" | "kind" | "label" | "title">;

export function truncate(text: string, max = LABEL_MAX): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Cubic Bézier from the right-middle of `from` to the left-middle of `to`. */
export function edgePath(
  from: Pick<GraphNode, "x" | "y" | "w" | "h">,
  to: Pick<GraphNode, "x" | "y" | "h">,
): string {
  const x1 = from.x + from.w;
  const y1 = from.y + from.h / 2;
  const x2 = to.x;
  const y2 = to.y + to.h / 2;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

/** Keep at most GRAPH_MAX_ROWS rows; overflow becomes one `more` node. */
function capColumn(col: Draft[], column: number): (Draft & { hidden: number })[] {
  const rows = col.map((d) => ({ ...d, hidden: 0 }));
  if (rows.length <= GRAPH_MAX_ROWS) return rows;
  const kept = rows.slice(0, GRAPH_MAX_ROWS - 1);
  const hidden = rows.length - kept.length;
  return [...kept, { id: `more:${column}`, kind: "more", label: "", title: "", hidden }];
}

export function layoutGraph(downstream: DownstreamImpact[]): GraphLayout {
  const symbols: Draft[] = [];
  const callers = new Map<string, Draft>();
  const endpoints = new Map<string, Draft>();
  const crons = new Map<string, Draft>();
  const edgeKeys: { from: string; to: string }[] = [];
  const seenEdges = new Set<string>();
  const addEdge = (from: string, to: string) => {
    const key = `${from}->${to}`;
    if (seenEdges.has(key)) return;
    seenEdges.add(key);
    edgeKeys.push({ from, to });
  };

  for (const g of downstream) {
    const sid = `s:${g.symbol}`;
    const symbolText = `${g.symbol}()`;
    symbols.push({ id: sid, kind: "symbol", label: truncate(symbolText), title: symbolText });

    for (const c of g.callers) {
      const cid = `c:${c.file}#${c.name}`;
      if (!callers.has(cid)) {
        callers.set(cid, {
          id: cid,
          kind: "caller",
          label: truncate(c.name),
          title: `${c.name} (${c.file}:${c.line})`,
        });
      }
      addEdge(sid, cid);
      for (const e of c.endpoints) {
        const eid = `e:${e}`;
        if (!endpoints.has(eid)) endpoints.set(eid, { id: eid, kind: "endpoint", label: truncate(e), title: e });
        addEdge(cid, eid);
      }
      for (const j of c.crons) {
        const jid = `j:${j}`;
        if (!crons.has(jid)) crons.set(jid, { id: jid, kind: "cron", label: truncate(j), title: j });
        addEdge(cid, jid);
      }
    }
  }

  const totals = {
    symbols: symbols.length,
    callers: callers.size,
    endpoints: endpoints.size,
    crons: crons.size,
  };

  const columns = [
    capColumn(symbols, 0),
    capColumn([...callers.values()], 1),
    capColumn([...endpoints.values(), ...crons.values()], 2),
  ];
  const maxRows = Math.max(0, ...columns.map((c) => c.length));
  const height = PAD * 2 + maxRows * ROW_GAP;

  const nodes: GraphNode[] = [];
  columns.forEach((col, ci) => {
    // Centre each column vertically against the tallest one.
    const offset = ((maxRows - col.length) * ROW_GAP) / 2;
    col.forEach((d, i) => {
      nodes.push({
        ...d,
        x: COL_X[ci] ?? 0,
        y: PAD + offset + i * ROW_GAP + (ROW_GAP - NODE_H) / 2,
        w: NODE_W,
        h: NODE_H,
      });
    });
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: GraphEdge[] = [];
  for (const { from, to } of edgeKeys) {
    const a = byId.get(from);
    const b = byId.get(to);
    if (!a || !b) continue; // an end was folded into "+N more"
    edges.push({ id: `${from}->${to}`, from, to, d: edgePath(a, b) });
  }

  return { width: VIEW_W, height, nodes, edges, totals };
}
