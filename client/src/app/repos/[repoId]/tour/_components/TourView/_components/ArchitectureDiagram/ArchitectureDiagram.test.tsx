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
import { layoutDiagram } from "./helpers";

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
    expect(svg.querySelectorAll("line")).toHaveLength(2);
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
});
