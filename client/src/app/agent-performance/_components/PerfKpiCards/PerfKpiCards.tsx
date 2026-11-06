/* PerfKpiCards — Total runs, Total cost, Avg accept rate and Most-active agent
   (R-44), titled with the short range label (R-40), wrapping on a narrow
   viewport (R-88).
   - Total runs: the count and a runs sparkline per local day, per hour for the
     "1 day" preset, named "Runs per day" / "Runs per hour" (R-90…R-92). One
     bucket draws a single dot — the vendored Sparkline divides by length − 1 (D-18).
   - Total cost: house format or "—" (R-48, R-51), "DevDigest estimate" (R-45),
     the delta vs the previous window when both totals are known (R-94, R-95),
     the runs without a price (R-47).
   - Avg accept rate: pooled percent, banded (R-49, R-100, R-101), with a ring
     only while the rate is known (R-98, R-99).
   - Most-active: name and "<runs> runs · <rate>% accept", the rate banded (R-50, R-100). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Sparkline } from "@devdigest/ui";
import type { AgentPerformanceReport } from "@devdigest/shared";
import { AcceptRateValue } from "@/components/accept-rate-value";
import { CostDelta } from "@/components/cost-delta";
import { formatCostUsd } from "@/lib/format-cost";
import { ACCEPT_BAND_COLOR, acceptBand, acceptPercent } from "@/lib/perf-format";
import { AcceptRing } from "./_components/AcceptRing";
import { SPARK_DOT_R, SPARK_H, SPARK_W } from "./constants";
import { mostActiveRow, sparklinePoints } from "./helpers";
import { cx } from "./styles";

export function PerfKpiCards({
  report,
  rangeShort,
}: {
  report: AgentPerformanceReport;
  /** "(30D)" etc. (R-40). */
  rangeShort: string;
}): React.JSX.Element {
  const t = useTranslations("agentPerformance");
  const { totals } = report;
  const range = { range: rangeShort };
  const pct = acceptPercent(totals.accept_rate);
  const ringColor = ACCEPT_BAND_COLOR[acceptBand(totals.accept_rate, totals.decided)];
  // One Intl walk per loaded report, not per render: an uncapped custom range
  // (Q-05) walks thousands of local days (F-03). `report` is the query's data
  // object, so its identity changes only when a new answer arrives.
  const points = React.useMemo(() => sparklinePoints(report), [report]);

  return (
    <div className={cx.grid}>
      <Card title={t("kpi.totalRuns", range)}>
        <div className={cx.valueRow}>
          <span className={cx.value}>{totals.runs}</span>
          <RunsSparkline
            points={points}
            label={t(totals.bucket_unit === "hour" ? "kpi.sparklinePerHour" : "kpi.sparklinePerDay")}
          />
        </div>
      </Card>

      <Card title={t("kpi.totalCost", range)}>
        <span className={cx.value}>{formatCostUsd(totals.total_cost_usd)}</span>
        <span className={cx.caption}>{t("estimate.label")}</span>
        <CostDelta comparison={totals.comparison} />
        {totals.unpriced_runs > 0 && <span className={cx.sub}>{t("kpi.unpriced", { count: totals.unpriced_runs })}</span>}
      </Card>

      <Card title={t("kpi.avgAccept", range)}>
        <div className={cx.acceptRow}>
          <AcceptRateValue figures={totals} variant="kpi" />
          {pct !== null && <AcceptRing percent={pct} color={ringColor} />}
        </div>
      </Card>

      <Card title={t("kpi.mostActive", range)}>
        <MostActive report={report} />
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className={cx.card}>
      <h3 className={cx.title}>{title}</h3>
      {children}
    </div>
  );
}

function RunsSparkline({ points, label }: { points: number[]; label: string }): React.JSX.Element | null {
  if (points.length === 0) return null;
  return (
    <div role="img" aria-label={label} className={cx.spark}>
      {points.length === 1 ? (
        <svg width={SPARK_W} height={SPARK_H} aria-hidden="true" focusable="false">
          <circle cx={SPARK_W / 2} cy={SPARK_H / 2} r={SPARK_DOT_R} fill="var(--accent)" />
        </svg>
      ) : (
        <Sparkline data={points} w={SPARK_W} h={SPARK_H} />
      )}
    </div>
  );
}

function MostActive({ report }: { report: AgentPerformanceReport }): React.JSX.Element {
  const t = useTranslations("agentPerformance");
  const row = mostActiveRow(report);
  if (!row) return <span className={cx.value}>{t("kpi.noMostActive")}</span>;
  const f = row.figures;
  const pct = acceptPercent(f.accept_rate);
  const color = ACCEPT_BAND_COLOR[acceptBand(f.accept_rate, f.decided)];
  return (
    <>
      <span className={cx.name} title={row.agent_name ?? undefined}>
        {row.agent_name}
      </span>
      <span className={cx.sub}>
        {pct === null
          ? t("kpi.mostActiveNoDecisions", { runs: f.runs })
          : t.rich("kpi.mostActiveLine", {
              runs: f.runs,
              rate: pct,
              pct: (chunks) => <span style={{ color }}>{chunks}</span>,
            })}
      </span>
    </>
  );
}
