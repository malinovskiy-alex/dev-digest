/** Pure layout for the architecture diagram — deterministic for equal input. */
import type { TourComponent, TourConnection } from "@devdigest/shared";
import { BOX_H, BOX_W, GAP_X, GAP_Y, LABEL_CHARS, PAD } from "./constants";

export interface DiagramNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DiagramEdge {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Cut a label to what fits in a box, with `…`. */
export function boxLabel(label: string): string {
  return label.length > LABEL_CHARS ? `${label.slice(0, LABEL_CHARS - 1)}…` : label;
}

/**
 * Layered left-to-right layout: a component's layer is the longest path to it
 * from a source over the connections, with back-edges (found by DFS in input
 * order) ignored; order within a layer is input order.
 */
export function layoutDiagram(
  components: TourComponent[],
  connections: TourConnection[],
): { nodes: DiagramNode[]; edges: DiagramEdge[]; width: number; height: number } {
  const ids = components.map((c) => c.id);
  const known = new Set(ids);
  const edges = connections.filter((e) => known.has(e.from) && known.has(e.to) && e.from !== e.to);
  const out = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of edges) out.get(e.from)!.push(e.to);

  // DFS in input order; an edge into a node still on the stack is a back-edge.
  const state = new Map<string, 1 | 2>();
  const back = new Set<string>();
  const visit = (u: string) => {
    state.set(u, 1);
    for (const v of out.get(u)!) {
      if (state.get(v) === 1) back.add(`${u}\u0001${v}`);
      else if (!state.has(v)) visit(v);
    }
    state.set(u, 2);
  };
  for (const id of ids) if (!state.has(id)) visit(id);
  const dag = edges.filter((e) => !back.has(`${e.from}\u0001${e.to}`));

  // Longest path: relax the DAG edges until stable (≤ n passes).
  const layer = new Map<string, number>(ids.map((id) => [id, 0]));
  for (let pass = 0; pass < ids.length; pass += 1) {
    let changed = false;
    for (const e of dag) {
      const next = layer.get(e.from)! + 1;
      if (next > layer.get(e.to)!) {
        layer.set(e.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const rowInLayer = new Map<number, number>();
  const nodes: DiagramNode[] = ids.map((id) => {
    const l = layer.get(id)!;
    const row = rowInLayer.get(l) ?? 0;
    rowInLayer.set(l, row + 1);
    return { id, x: PAD + l * (BOX_W + GAP_X), y: PAD + row * (BOX_H + GAP_Y), w: BOX_W, h: BOX_H };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const lines: DiagramEdge[] = edges.map((e) => {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    if (b.x > a.x) return { key: `${e.from}>${e.to}`, x1: a.x + a.w, y1: a.y + a.h / 2, x2: b.x, y2: b.y + b.h / 2 };
    if (b.x < a.x) return { key: `${e.from}>${e.to}`, x1: a.x, y1: a.y + a.h / 2, x2: b.x + b.w, y2: b.y + b.h / 2 };
    const down = b.y > a.y;
    return {
      key: `${e.from}>${e.to}`,
      x1: a.x + a.w / 2,
      y1: down ? a.y + a.h : a.y,
      x2: b.x + b.w / 2,
      y2: down ? b.y : b.y + b.h,
    };
  });

  const layers = Math.max(0, ...nodes.map((n) => layer.get(n.id)!)) + 1;
  const rows = Math.max(0, ...rowInLayer.values());
  return {
    nodes,
    edges: lines,
    width: PAD * 2 + layers * BOX_W + (layers - 1) * GAP_X,
    height: PAD * 2 + rows * BOX_H + Math.max(0, rows - 1) * GAP_Y,
  };
}
