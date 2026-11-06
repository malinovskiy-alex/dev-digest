/* SkillKpiCards — the four KPI cards of the skill Stats tab (L08 skill-stats
   R-35 … R-41): Used by ("<N> agents" / "<M> ran in period"), Pull frequency
   ("<p>% (<n>/<d> PRs)" or "—" when no PR was reviewed — never "0%"), Accept
   rate (the agent Stats tab's `AcceptRateValue`, bands and "Small sample"
   included — D-12) and Findings (the widget's total, R-68). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { SkillStatsReport } from "@devdigest/shared";
import { AcceptRateValue } from "@/components/accept-rate-value";
import { ratePercent } from "@/lib/perf-format";
import { cx } from "./styles";

export function SkillKpiCards({
  report,
  rangeSentence,
}: {
  report: SkillStatsReport;
  /** "the last 30 days" — for the unknown pull frequency (R-38) */
  rangeSentence: string;
}): React.JSX.Element {
  const t = useTranslations("skills");
  const pf = report.pull_frequency;
  const pct = ratePercent(pf.rate);
  return (
    <div className={cx.grid}>
      <Card title={t("stats.kpi.usedBy")}>
        <span className={cx.value}>{t("stats.kpi.usedByValue", { count: report.used_by })}</span>
        <span className={cx.sub}>{t("stats.kpi.ranInPeriod", { count: report.ran_in_period })}</span>
      </Card>
      <Card title={t("stats.kpi.pullFreq")}>
        {pct === null ? (
          <>
            <span className={cx.value}>—</span>
            <span className={cx.sub}>{t("stats.kpi.pullFreqUnknown", { range: rangeSentence })}</span>
          </>
        ) : (
          <>
            <span className={cx.value}>
              {t("stats.kpi.pullFreqValue", { pct, n: pf.prs_with_skill, d: pf.prs_reviewed })}
            </span>
            <span className={cx.sub}>{t("stats.kpi.pullFreqCaption")}</span>
          </>
        )}
      </Card>
      <Card title={t("stats.kpi.accept")}>
        <AcceptRateValue figures={report.figures} variant="kpi" />
      </Card>
      <Card title={t("stats.kpi.findings")}>
        <span className={cx.value}>{report.findings.total}</span>
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
