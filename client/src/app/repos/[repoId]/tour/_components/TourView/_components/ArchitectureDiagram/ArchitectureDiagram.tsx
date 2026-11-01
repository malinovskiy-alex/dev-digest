/* ArchitectureDiagram — a hand-drawn box-and-arrow SVG of the grounded
   components, coloured by kind (AC-32): a quiet tinted fill and a coloured border per kind
   inside a darker inset panel (design D-10). Edges are orthogonal routes that
   never cross a box (F-45). Labels are plain SVG text: no links,
   no handlers, no raw HTML (AC-63). A visually hidden list repeats the
   connections for screen readers. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { TourComponent, TourConnection } from "@devdigest/shared";
import { KIND_COLORS, KIND_STROKES } from "./constants";
import { boxLabel, layoutDiagram, routePath } from "./helpers";
import { cx } from "./styles";

export function ArchitectureDiagram({
  components,
  connections,
}: {
  components: TourComponent[];
  connections: TourConnection[];
}): React.JSX.Element {
  const t = useTranslations("onboarding");
  const markerId = `tour-arrow-${React.useId().replace(/:/g, "")}`;
  const layout = layoutDiagram(components, connections);
  const byId = new Map(components.map((c) => [c.id, c]));

  return (
    <div className={cx.wrap}>
      <svg
        role="img"
        className={cx.svg}
        aria-label={t("diagramLabel", { count: components.length })}
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
      >
        <defs>
          <marker id={markerId} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className={cx.arrow} />
          </marker>
        </defs>
        {layout.edges.map((e) => (
          <path key={e.key} d={routePath(e.points)} fill="none" className={cx.edge} strokeWidth={1.25} strokeLinejoin="round" markerEnd={`url(#${markerId})`} />
        ))}
        {layout.nodes.map((n) => {
          const c = byId.get(n.id)!;
          return (
            <g key={n.id}>
              <title>{c.label}</title>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={8} fill={KIND_COLORS[c.kind]} stroke={KIND_STROKES[c.kind]} strokeWidth={1.5} />
              <text x={n.x + n.w / 2} y={n.y + n.h / 2} textAnchor="middle" dominantBaseline="central" className={cx.label}>
                {boxLabel(c.label)}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className={cx.srOnly} aria-label={t("diagramEdges")}>
        {connections.map((e) => (
          <li key={`${e.from}>${e.to}`}>
            {t("diagramEdge", { from: byId.get(e.from)?.label ?? e.from, to: byId.get(e.to)?.label ?? e.to })}
          </li>
        ))}
      </ul>
    </div>
  );
}
