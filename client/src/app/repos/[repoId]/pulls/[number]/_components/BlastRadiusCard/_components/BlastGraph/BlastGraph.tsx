"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { DownstreamImpact } from "@devdigest/shared";
import { layoutGraph, type GraphNode } from "./helpers";
import { cx, NODE_RECT, NODE_TEXT } from "./styles";

/* BlastGraph — a picture of the same data the tree shows. Plain SVG, laid out
   by layoutGraph(); every repo string reaches the DOM as React text (escaped).
   The tree stays the accessible, linkable view. */
export function BlastGraph({ downstream }: { downstream: DownstreamImpact[] }): React.JSX.Element {
  const t = useTranslations("blast");
  const titleId = React.useId();
  const descId = React.useId();

  if (downstream.length === 0) return <p className={cx.empty}>{t("graph.empty")}</p>;

  const layout = layoutGraph(downstream);
  const { totals } = layout;

  return (
    <div className={cx.wrap}>
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className={cx.svg}
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
      >
        <title id={titleId}>{t("graph.ariaLabel")}</title>
        <desc id={descId}>
          {t("graph.summary", {
            symbols: totals.symbols,
            callers: totals.callers,
            targets: totals.endpoints + totals.crons,
          })}
        </desc>
        {layout.edges.map((e) => (
          <path key={e.id} d={e.d} className={cx.edge} />
        ))}
        {layout.nodes.map((n) => (
          <GraphNodeBox key={n.id} node={n} />
        ))}
      </svg>
      <ul className={cx.legend}>
        <LegendItem dot={cx.dotSymbol} label={t("graph.legend.symbol")} />
        <LegendItem dot={cx.dotCaller} label={t("graph.legend.caller")} />
        <LegendItem dot={cx.dotEndpoint} label={t("graph.legend.endpoint")} />
        {totals.crons > 0 && <LegendItem dot={cx.dotCron} label={t("graph.legend.cron")} />}
      </ul>
    </div>
  );
}

function GraphNodeBox({ node }: { node: GraphNode }): React.JSX.Element {
  const t = useTranslations("blast");
  const label = node.kind === "more" ? t("graph.more", { count: node.hidden }) : node.label;
  return (
    <g>
      <title>{node.kind === "more" ? label : node.title}</title>
      <rect x={node.x} y={node.y} width={node.w} height={node.h} rx={5} className={NODE_RECT[node.kind]} />
      <text x={node.x + 8} y={node.y + node.h / 2} dominantBaseline="central" className={NODE_TEXT[node.kind]}>
        {label}
      </text>
    </g>
  );
}

function LegendItem({ dot, label }: { dot: string; label: string }): React.JSX.Element {
  return (
    <li className={cx.legendItem}>
      <span className={dot} aria-hidden />
      {label}
    </li>
  );
}
