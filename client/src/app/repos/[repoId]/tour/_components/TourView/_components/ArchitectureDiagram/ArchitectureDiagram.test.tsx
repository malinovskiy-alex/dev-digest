/**
 * ArchitectureDiagram — hand-drawn boxes and arrows, coloured by kind, labels
 * as plain text (plan step 30b: AC-32, AC-63), and the layout helper.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { TourComponent, TourConnection } from "@devdigest/shared";
import onboarding from "../../../../../../../../../messages/en/onboarding.json";
import { ArchitectureDiagram } from "./ArchitectureDiagram";
import { layoutDiagram, routePath, type DiagramNode, type Point } from "./helpers";

afterEach(cleanup);

const renderDiagram = (components: TourComponent[], connections: TourConnection[]) =>
  render(
    <NextIntlClientProvider locale="en" messages={{ onboarding }}>
      <ArchitectureDiagram components={components} connections={connections} />
    </NextIntlClientProvider>,
  );

describe("ArchitectureDiagram", () => {
  it("AC-32 — 3 components + 2 connections → an svg[role=img] with 3 labels, 2 lines, fill per kind", () => {
    renderDiagram(
      [
        { id: "web", label: "Web app", kind: "ui" },
        { id: "api", label: "API server", kind: "api" },
        { id: "db", label: "Postgres", kind: "data" },
      ],
      [
        { from: "web", to: "api" },
        { from: "api", to: "db" },
      ],
    );
    const svg = screen.getByRole("img");
    expect(svg.tagName.toLowerCase()).toBe("svg");
    for (const label of ["Web app", "API server", "Postgres"]) {
      expect(Array.from(svg.querySelectorAll("text")).some((t) => t.textContent === label)).toBe(true);
    }
    // F-46: edges are orthogonal <path>s ending in an arrow marker (F-45), not
    // <line>s. The marker's own triangle (in <defs>) carries no marker-end.
    const arrows = svg.querySelectorAll("path[marker-end]");
    expect(arrows).toHaveLength(2);
    for (const a of Array.from(arrows)) expect(a.getAttribute("d")).toMatch(/^M [\d.]+ [\d.]+( L [\d.]+ [\d.]+)+$/);
    const fills = Array.from(svg.querySelectorAll("rect")).map((r) => r.getAttribute("fill"));
    expect(fills).toHaveLength(3);
    expect(new Set(fills).size).toBe(3);
  });

  it("AC-63 — an HTML-looking label renders as literal text, with no element or handler", () => {
    const evil = "<b onclick=x>hi</b>";
    renderDiagram(
      [
        { id: "a", label: evil, kind: "service" },
        { id: "b", label: "B", kind: "service" },
      ],
      [{ from: "a", to: "b" }],
    );
    const svg = screen.getByRole("img");
    expect(svg.querySelector("b")).toBeNull();
    expect(svg.querySelector("[onclick]")).toBeNull();
    expect(svg.querySelector("a")).toBeNull();
    expect(svg.querySelector("title")!.textContent).toBe(evil);
  });

  it("layoutDiagram is deterministic and gives no overlapping boxes for a 5-node chain", () => {
    const comps: TourComponent[] = ["a", "b", "c", "d", "e"].map((id) => ({ id, label: id, kind: "service" }));
    const conns: TourConnection[] = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "c", to: "d" },
      { from: "d", to: "e" },
    ];
    const one = layoutDiagram(comps, conns);
    expect(layoutDiagram(comps, conns)).toEqual(one);
    const n = one.nodes;
    for (let i = 0; i < n.length; i += 1) {
      for (let j = i + 1; j < n.length; j += 1) {
        const a = n[i]!;
        const b = n[j]!;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
    for (const node of n) {
      expect(node.x + node.w).toBeLessThanOrEqual(one.width);
      expect(node.y + node.h).toBeLessThanOrEqual(one.height);
    }
  });

  // -------------------------------------------------------------------------
  // F-45 (UI-D-10): orthogonal routing. A property test over seeded random
  // graphs, plus the two cases the finding names: a layer-skipping edge and a
  // back-edge both run in the gutter under the boxes, never through one.
  // -------------------------------------------------------------------------

  /** A segment enters a box iff it overlaps the box's open interior. */
  const entersBox = ([x1, y1]: Point, [x2, y2]: Point, b: DiagramNode) =>
    Math.max(x1, x2) > b.x && Math.min(x1, x2) < b.x + b.w && Math.max(y1, y2) > b.y && Math.min(y1, y2) < b.y + b.h;
  const overlaps = (a: DiagramNode, b: DiagramNode) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  function checkLayout(comps: TourComponent[], conns: TourConnection[]) {
    const one = layoutDiagram(comps, conns);
    expect(layoutDiagram(comps, conns), "deterministic").toEqual(one);
    const byId = new Map(one.nodes.map((n) => [n.id, n]));
    for (let i = 0; i < one.nodes.length; i += 1)
      for (let j = i + 1; j < one.nodes.length; j += 1) expect(overlaps(one.nodes[i]!, one.nodes[j]!), "box overlap").toBe(false);
    for (const e of one.edges) {
      const [from, to] = e.key.split(">");
      const a = byId.get(from!)!;
      const b = byId.get(to!)!;
      const first = e.points[0]!;
      const last = e.points[e.points.length - 1]!;
      // leaves the source on its right edge, arrives on the target's left edge
      expect(first[0], e.key).toBe(a.x + a.w);
      expect(first[1] > a.y && first[1] < a.y + a.h, e.key).toBe(true);
      expect(last[0], e.key).toBe(b.x);
      expect(last[1] > b.y && last[1] < b.y + b.h, e.key).toBe(true);
      for (let k = 0; k + 1 < e.points.length; k += 1) {
        const p = e.points[k]!;
        const q = e.points[k + 1]!;
        expect(p[0] === q[0] || p[1] === q[1], `${e.key} segment ${k} is diagonal`).toBe(true);
        for (const pt of [p, q]) {
          expect(pt[0] >= 0 && pt[0] <= one.width && pt[1] >= 0 && pt[1] <= one.height, `${e.key} leaves the canvas`).toBe(true);
        }
        for (const n of one.nodes) expect(entersBox(p, q, n), `${e.key} segment ${k} enters ${n.id}`).toBe(false);
      }
      expect(routePath(e.points)).toBe(e.points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" "));
    }
    return one;
  }

  it("F-45 — 500 seeded random graphs: deterministic, axis-aligned, no box crossed, no box overlap, edges end on their boxes", () => {
    let seed = 20261101;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let t = 0; t < 500; t += 1) {
      const n = 2 + Math.floor(rnd() * 11); // up to 12 components (D-11)
      const comps: TourComponent[] = Array.from({ length: n }, (_, i) => ({ id: `c${i}`, label: `c${i}`, kind: "service" }));
      const m = 1 + Math.floor(rnd() * 24); // up to 24 connections (D-11)
      const seen = new Set<string>();
      const conns: TourConnection[] = [];
      for (let k = 0; k < m; k += 1) {
        const from = `c${Math.floor(rnd() * n)}`;
        const to = `c${Math.floor(rnd() * n)}`;
        if (from === to || seen.has(`${from}>${to}`)) continue; // grounding drops self-loops and duplicates
        seen.add(`${from}>${to}`);
        conns.push({ from, to });
      }
      checkLayout(comps, conns);
    }
  });

  it("F-45 — a layer-skipping edge and a back-edge both use the gutter below every box", () => {
    const comps: TourComponent[] = ["a", "b", "c"].map((id) => ({ id, label: id, kind: "service" }));
    const conns: TourConnection[] = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "a", to: "c" }, // skips layer b
      { from: "c", to: "a" }, // back-edge
    ];
    const one = checkLayout(comps, conns);
    const bottom = Math.max(...one.nodes.map((n) => n.y + n.h));
    const route = (key: string) => one.edges.find((e) => e.key === key)!.points;
    const lowest = (pts: Point[]) => Math.max(...pts.map((p) => p[1]));
    expect(lowest(route("a>c"))).toBeGreaterThan(bottom);
    expect(lowest(route("c>a"))).toBeGreaterThan(bottom);
    // two gutter edges never share a lane
    expect(lowest(route("a>c"))).not.toBe(lowest(route("c>a")));
    // an edge between adjacent layers stays among the boxes
    expect(lowest(route("a>b"))).toBeLessThanOrEqual(bottom);
    // the canvas holds the gutter
    expect(one.height).toBeGreaterThanOrEqual(lowest(route("c>a")));
  });
});
