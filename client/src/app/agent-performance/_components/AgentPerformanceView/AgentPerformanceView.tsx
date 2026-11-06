/* /agent-performance — which agents earn their keep (L08).

   The header (title, subtitle, range control) is shown in every state (R-43,
   R-73). Below it, exactly one of:
   - loading → skeletons in every value slot, no digit (R-70);
   - error → the reason and Retry, no figure (R-71);
   - no agent in the workspace → "No agents yet" + a link to Agents (R-72);
   - agents but no counted run → "No agent runs in <range>", the hint, and
     "Go to Pull Requests" when a repository is active (R-73, R-104, R-105);
   - data → KPI cards, the billing note, the agents table, the cost breakdown.
   Every request here is a GET (R-74). The caption under the range control
   names the window of the figures on screen (L08 skill-stats R-32). */
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ErrorState, Skeleton } from "@devdigest/ui";
import type { AgentPerformanceReport } from "@devdigest/shared";
import { AppShell } from "@/components/app-shell";
import { CostEstimateNote } from "@/components/cost-estimate-note";
import {
  RangeCaption,
  RangeControl,
  usePerfRange,
  useRangeLabels,
  type RangeLabels,
} from "@/components/perf-range-control";
import { ApiError } from "@/lib/api";
import { useAgentPerformance } from "@/lib/hooks/agent-performance";
import { bucketFor, type PerfRange, type PerfRangeChoice } from "@/lib/perf-range";
import { useActiveRepo } from "@/lib/repo-context";
import { AgentPerfTable } from "../AgentPerfTable";
import { CostBreakdown } from "../CostBreakdown";
import { PerfKpiCards } from "../PerfKpiCards";
import { SKELETON_CHART_COUNT, SKELETON_KPI_COUNT, SKELETON_ROW_COUNT } from "./constants";
import { cx } from "./styles";

export function AgentPerformanceView(): React.JSX.Element {
  const t = useTranslations("agentPerformance");
  const { choice, range, apply } = usePerfRange();
  const labels = useRangeLabels(choice);
  const q = useAgentPerformance(range, bucketFor(choice));

  return (
    <AppShell crumb={[{ label: t("title") }]}>
      <div className={cx.page}>
        <header className={cx.header}>
          <div>
            <h1 className={cx.title}>{t("title")}</h1>
            <p className={cx.subtitle}>{t("subtitle")}</p>
          </div>
          <div className={cx.controls}>
            <RangeControl choice={choice} onApply={apply} />
            <RangeCaption choice={choice} applied={q.isError ? undefined : q.data?.range} />
          </div>
        </header>
        {q.isError ? (
          <ErrorState
            title={t("states.loadError")}
            body={q.error instanceof ApiError ? q.error.message : String(q.error)}
            onRetry={() => void q.refetch()}
          />
        ) : q.data ? (
          <Dashboard report={q.data} choice={choice} range={range} labels={labels} />
        ) : (
          <DashboardSkeleton />
        )}
      </div>
    </AppShell>
  );
}

function Dashboard({
  report,
  choice,
  range,
  labels,
}: {
  report: AgentPerformanceReport;
  choice: PerfRangeChoice;
  range: PerfRange;
  labels: RangeLabels;
}): React.JSX.Element {
  const t = useTranslations("agentPerformance");
  if (!report.agents.some((r) => r.kind === "agent")) {
    return (
      <div className={cx.empty}>
        <p className={cx.emptyTitle}>{t("states.noAgents")}</p>
        <Link href="/agents" className={cx.emptyLink}>
          {t("states.noAgentsLink")}
        </Link>
      </div>
    );
  }
  if (report.totals.runs === 0) return <NoRuns sentence={labels.sentence} />;
  return (
    <div className={cx.body}>
      <PerfKpiCards report={report} rangeShort={labels.short} />
      <CostEstimateNote />
      <AgentPerfTable rows={report.agents} choice={choice} range={range} rangeShort={labels.short} />
      <CostBreakdown report={report} />
    </div>
  );
}

function NoRuns({ sentence }: { sentence: string }): React.JSX.Element {
  const t = useTranslations("agentPerformance");
  const { activeRepo } = useActiveRepo();
  return (
    <div className={cx.empty}>
      <p className={cx.emptyTitle}>{t("states.noRuns", { range: sentence })}</p>
      <p className={cx.emptyBody}>{t("states.noRunsHint")}</p>
      {activeRepo && (
        <Link href={`/repos/${encodeURIComponent(activeRepo.id)}/pulls`} className={cx.emptyLink}>
          {t("states.goToPulls")}
        </Link>
      )}
    </div>
  );
}

function DashboardSkeleton(): React.JSX.Element {
  return (
    <div className={cx.body} aria-busy="true">
      <div className={cx.kpiGrid}>
        {Array.from({ length: SKELETON_KPI_COUNT }, (_, i) => (
          <div key={i} className={cx.kpiSkeleton}>
            <Skeleton width={120} height={11} />
            <Skeleton width={80} height={26} />
          </div>
        ))}
      </div>
      <div className={cx.tableSkeleton}>
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
          <Skeleton key={i} height={18} />
        ))}
      </div>
      <div className={cx.chartGrid}>
        {Array.from({ length: SKELETON_CHART_COUNT }, (_, i) => (
          <Skeleton key={i} height={160} />
        ))}
      </div>
    </div>
  );
}
