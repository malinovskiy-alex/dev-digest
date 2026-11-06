/* StatsTab — one skill's figures for the applied range (L08 skill-stats
   R-28 … R-58): the figures of the agents that use the skill NOW (R-01, R-81).

   Header: title, the agent Stats tab's range control and the applied-window
   caption (R-28, R-31). Below it, exactly one of:
   - loading → skeletons in the four KPI slots, the agents list and the widget,
     no digit (R-50);
   - error → the reason and Retry, no figure (R-51); a 404 also makes the page
     re-read the skill and show its not-found state (R-58, D-15, in the hook);
   - data → the "skill is off" note when it is off (R-48), the KPI cards, the
     attribution note (R-81), then the agents list and the Findings widget side
     by side, stacked on a narrow screen (R-47, R-54). A range with no run keeps
     all of it (R-49).
   The range lives in the address next to `?tab=stats` (R-29); every request is
   a GET (R-52). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { ErrorState, Skeleton } from "@devdigest/ui";
import type { Skill, SkillStatsReport } from "@devdigest/shared";
import { FindingsWidget } from "@/components/findings-widget";
import {
  RangeCaption,
  RangeControl,
  usePerfRange,
  useRangeLabels,
  type RangeLabels,
} from "@/components/perf-range-control";
import { ApiError } from "@/lib/api";
import { useSkillStats } from "@/lib/hooks/skill-stats";
import type { PerfRangeChoice } from "@/lib/perf-range";
import { SkillAgentsList } from "./_components/SkillAgentsList";
import { SkillKpiCards } from "./_components/SkillKpiCards";
import { KPI_COUNT, SKELETON_AGENT_ROWS } from "./constants";
import { cx } from "./styles";

export function StatsTab({ skill }: { skill: Skill }): React.JSX.Element {
  const t = useTranslations("skills");
  const { choice, range, apply } = usePerfRange();
  const labels = useRangeLabels(choice);
  const q = useSkillStats(skill.id, range);

  return (
    <div className={cx.wrap}>
      <div className={cx.header}>
        <h2 className={cx.h2}>{t("stats.heading")}</h2>
        <div className={cx.controls}>
          <RangeControl choice={choice} onApply={apply} />
          <RangeCaption choice={choice} applied={q.isError ? undefined : q.data?.range} />
        </div>
      </div>
      {q.isError ? (
        <ErrorState
          title={t("stats.loadError")}
          body={q.error instanceof ApiError ? q.error.message : String(q.error)}
          onRetry={() => void q.refetch()}
        />
      ) : !q.data ? (
        <StatsSkeleton />
      ) : (
        <StatsBody report={q.data} choice={choice} labels={labels} />
      )}
    </div>
  );
}

function StatsBody({
  report,
  choice,
  labels,
}: {
  report: SkillStatsReport;
  choice: PerfRangeChoice;
  labels: RangeLabels;
}): React.JSX.Element {
  const t = useTranslations("skills");
  const tp = useTranslations("agentPerformance");
  // The window the figures were computed for — an "Open" link pins it (D-13).
  const applied = { from: new Date(report.range.from), to: new Date(report.range.to) };
  return (
    <>
      {!report.skill.enabled && <p className={cx.offNote}>{t("stats.offNote")}</p>}
      <SkillKpiCards report={report} rangeSentence={labels.sentence} />
      <p className={cx.note}>{t("stats.attributionNote")}</p>
      <div className={cx.columns}>
        <SkillAgentsList agents={report.agents} choice={choice} applied={applied} />
        <FindingsWidget findings={report.findings} emptyLabel={tp("findings.empty", { range: labels.sentence })} />
      </div>
    </>
  );
}

function StatsSkeleton(): React.JSX.Element {
  return (
    <div className={cx.skeleton} aria-busy="true">
      <div className={cx.kpiGrid}>
        {Array.from({ length: KPI_COUNT }, (_, i) => (
          <div key={i} className={cx.panel}>
            <Skeleton width={90} height={11} />
            <Skeleton width={70} height={26} />
          </div>
        ))}
      </div>
      <div className={cx.columns}>
        <div className={cx.panel}>
          {Array.from({ length: SKELETON_AGENT_ROWS }, (_, i) => (
            <Skeleton key={i} height={18} />
          ))}
        </div>
        <div className={cx.panel}>
          <Skeleton height={132} />
        </div>
      </div>
    </div>
  );
}
