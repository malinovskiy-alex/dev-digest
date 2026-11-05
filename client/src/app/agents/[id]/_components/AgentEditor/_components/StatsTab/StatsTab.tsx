/* StatsTab — one agent's figures for the applied range (L08, R-75…R-84).
   The same aggregation as its dashboard row (R-01) and the same components and
   formatters (R-77): house cost format, "6.2s", the accept rate with its
   denominator, band colour and trend arrow (R-109…R-111), the cost delta
   (R-107, R-108), relative Last run. No sparkline, no ring, no colour marker
   (R-112, D-28). The range lives in the address next to `?tab=stats` (R-84). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { ErrorState, Skeleton } from "@devdigest/ui";
import type { Agent, AgentStatsReport } from "@devdigest/shared";
import { AcceptRateValue } from "@/components/accept-rate-value";
import { CostDelta } from "@/components/cost-delta";
import { CostEstimateNote } from "@/components/cost-estimate-note";
import { LastRunTime } from "@/components/last-run-time";
import { RangeControl, usePerfRange, useRangeLabels } from "@/components/perf-range-control";
import { ApiError } from "@/lib/api";
import { formatCostUsd } from "@/lib/format-cost";
import { useAgentStats } from "@/lib/hooks/agent-performance";
import { formatDurationSec } from "@/lib/perf-format";
import { SKELETON_TILE_COUNT } from "./constants";
import { cx } from "./styles";

export function StatsTab({ agent }: { agent: Agent }): React.JSX.Element {
  const t = useTranslations("agentPerformance");
  const { choice, range, apply } = usePerfRange();
  const labels = useRangeLabels(choice);
  const q = useAgentStats(agent.id, range);

  return (
    <div className={cx.wrap}>
      <div className={cx.header}>
        <h2 className={cx.h2}>{t("stats.tabLabel")}</h2>
        <RangeControl choice={choice} onApply={apply} />
      </div>
      {q.isError ? (
        <ErrorState
          title={t("stats.loadError")}
          body={q.error instanceof ApiError ? q.error.message : String(q.error)}
          onRetry={() => void q.refetch()}
        />
      ) : !q.data ? (
        <div className={cx.grid} aria-busy="true">
          {Array.from({ length: SKELETON_TILE_COUNT }, (_, i) => (
            <div key={i} className={cx.tile}>
              <Skeleton width={100} height={11} />
              <Skeleton width={70} height={22} />
            </div>
          ))}
        </div>
      ) : q.data.figures.runs === 0 ? (
        <p className={cx.empty}>{t("stats.noRuns", { name: agent.name, range: labels.sentence })}</p>
      ) : (
        <StatsFigures report={q.data} rangeShort={labels.short} />
      )}
    </div>
  );
}

function StatsFigures({ report, rangeShort }: { report: AgentStatsReport; rangeShort: string }): React.JSX.Element {
  const t = useTranslations("agentPerformance");
  const f = report.figures;
  const range = { range: rangeShort };
  const estimate = <span className={cx.caption}>{t("estimate.label")}</span>;
  return (
    <>
      <div className={cx.grid}>
        <Tile title={t("stats.runs", range)}>
          <span className={cx.value}>{f.runs}</span>
        </Tile>
        <Tile title={t("stats.totalCost", range)}>
          <span className={cx.value}>{formatCostUsd(f.total_cost_usd)}</span>
          {estimate}
          <CostDelta comparison={report.comparison} />
          {f.unpriced_runs > 0 && <span className={cx.sub}>{t("kpi.unpriced", { count: f.unpriced_runs })}</span>}
        </Tile>
        <Tile title={t("stats.avgCost", range)}>
          <span className={cx.value}>{formatCostUsd(f.avg_cost_usd)}</span>
          {estimate}
        </Tile>
        <Tile title={t("stats.unpriced", range)}>
          <span className={cx.value}>{f.unpriced_runs}</span>
        </Tile>
        <Tile title={t("stats.avgDuration", range)}>
          <span className={cx.value}>{formatDurationSec(f.avg_duration_ms)}</span>
        </Tile>
        <Tile title={t("stats.accept", range)}>
          <AcceptRateValue figures={f} comparison={report.comparison} variant="row" />
        </Tile>
        <Tile title={t("stats.accepted")}>
          <span className={cx.value}>{f.accepted}</span>
        </Tile>
        <Tile title={t("stats.dismissed")}>
          <span className={cx.value}>{f.dismissed}</span>
        </Tile>
        <Tile title={t("stats.pending")}>
          <span className={cx.value}>{f.pending}</span>
        </Tile>
        <Tile title={t("stats.lastRun")}>
          <LastRunTime iso={f.last_run_at} />
        </Tile>
      </div>
      <CostEstimateNote />
    </>
  );
}

function Tile({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className={cx.tile}>
      <h3 className={cx.tileTitle}>{title}</h3>
      {children}
    </div>
  );
}
