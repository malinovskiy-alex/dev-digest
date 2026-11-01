/** Pure layout for the architecture diagram — deterministic for equal input. */
import type { TourComponent, TourConnection } from "@devdigest/shared";
import { BOX_H, BOX_W, GAP_X, GAP_Y, GUTTER_GAP, LABEL_CHARS, LANE_STEP, LANES_PER_GAP, PAD } from "./constants";

export interface DiagramNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A point of a route, in SVG user units. */
export type Point = [number, number];

/** One connection, drawn as an orthogonal polyline from source to target. */
export interface DiagramEdge {
  key: string;
  points: Point[];
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

  // Rows per layer, in input order; each column is centred vertically on the
  // tallest one, so a single box sits level with the middle of its neighbours.
  const rowsOf = new Map<number, number>();
  for (const id of ids) rowsOf.set(layer.get(id)!, (rowsOf.get(layer.get(id)!) ?? 0) + 1);
  const rows = Math.max(0, ...rowsOf.values());
  const layers = Math.max(0, ...ids.map((id) => layer.get(id)!)) + 1;
  const pitchY = BOX_H + GAP_Y;
  const pitchX = BOX_W + GAP_X;

  // A back-edge into layer 0 or out of the last layer needs a full gap beside
  // the outer column to run its vertical segment in.
  const isBack = (e: TourConnection) => layer.get(e.to)! <= layer.get(e.from)!;
  const left = edges.some((e) => isBack(e) && layer.get(e.to) === 0) ? GAP_X : 0;
  const right = edges.some((e) => isBack(e) && layer.get(e.from) === layers - 1) ? GAP_X : 0;

  const rowInLayer = new Map<number, number>();
  const nodes: DiagramNode[] = ids.map((id) => {
    const l = layer.get(id)!;
    const row = rowInLayer.get(l) ?? 0;
    rowInLayer.set(l, row + 1);
    const offset = ((rows - rowsOf.get(l)!) * pitchY) / 2;
    return { id, x: PAD + left + l * pitchX, y: PAD + offset + row * pitchY, w: BOX_W, h: BOX_H };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));

  /** x of the middle of the gap right of layer `l` (`l = -1`: left of layer 0). */
  const gapX = (l: number) => PAD + left + l * pitchX + BOX_W + GAP_X / 2;
  const boxesBottom = PAD + rows * BOX_H + Math.max(0, rows - 1) * GAP_Y;

  // Orthogonal routes (F-45). Every vertical segment runs in a gap between
  // columns and every horizontal one either in a gap, along a box's own
  // middle into the neighbouring gap, or in the gutter under all the boxes —
  // so no route crosses a box. An edge between adjacent layers elbows in the
  // gap between them; any other edge (spanning layers, or a back-edge) drops
  // into its own gutter lane, runs along it and rises in the gap before its
  // target. Lanes and their gap offsets follow edge order: deterministic.
  let lane = 0;
  const routes: DiagramEdge[] = edges.map((e) => {
    const a = byId.get(e.from)!;
    const b = byId.get(e.to)!;
    const la = layer.get(e.from)!;
    const lb = layer.get(e.to)!;
    const ay = a.y + a.h / 2;
    const by = b.y + b.h / 2;
    const start: Point = [a.x + a.w, ay];
    const end: Point = [b.x, by];
    if (lb === la + 1) {
      const x = gapX(la);
      return { key: `${e.from}>${e.to}`, points: simplify([start, [x, ay], [x, by], end]) };
    }
    const k = lane;
    lane += 1;
    const shift = LANE_STEP * ((k % LANES_PER_GAP) + 1);
    const out = gapX(la) + shift;
    const into = gapX(lb - 1) - shift;
    const y = boxesBottom + GUTTER_GAP + k * LANE_STEP;
    return {
      key: `${e.from}>${e.to}`,
      points: simplify([start, [out, ay], [out, y], [into, y], [into, by], end]),
    };
  });

  const width = PAD * 2 + left + right + layers * BOX_W + (layers - 1) * GAP_X;
  const height = (lane > 0 ? boxesBottom + GUTTER_GAP + (lane - 1) * LANE_STEP : boxesBottom) + PAD;
  return { nodes, edges: routes, width, height };
}

/** Drops repeated points and the middle of three collinear ones. */
function simplify(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) continue;
    const prev = out[out.length - 2];
    if (prev && last && ((prev[0] === last[0] && last[0] === p[0]) || (prev[1] === last[1] && last[1] === p[1]))) {
      out[out.length - 1] = p;
      continue;
    }
    out.push(p);
  }
  return out;
}

/** An SVG path `d` for a route: straight segments only. */
export function routePath(points: ReadonlyArray<Point>): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
}
