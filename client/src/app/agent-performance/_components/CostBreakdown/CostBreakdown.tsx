/* CostBreakdown — "Cost breakdown · DevDigest estimate" with a by-agent and a
   by-model donut, each with a legend of name and amount (R-45, R-66, R-69).
   With no priced run in the range, one "No priced runs in this period" stands
   in for both charts (R-68). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { AgentPerformanceReport } from "@devdigest/shared";
import { CostDonut } from "./_components/CostDonut";
import { agentSegments, modelSegments } from "./helpers";
import { cx } from "./styles";

export function CostBreakdown({ report }: { report: AgentPerformanceReport }): React.JSX.Element {
  const t = useTranslations("agentPerformance");
  const headingId = React.useId();
  return (
    <section className={cx.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={cx.heading}>
        {t("breakdown.title")}
      </h2>
      {report.cost_by_agent.length === 0 ? (
        <p className={cx.empty}>{t("breakdown.noPriced")}</p>
      ) : (
        <div className={cx.grid}>
          <div className={cx.card}>
            <h3 className={cx.cardTitle}>{t("breakdown.byAgent")}</h3>
            <CostDonut
              title={t("breakdown.chartByAgent")}
              segments={agentSegments(report.cost_by_agent, t("table.deletedAgents"))}
            />
          </div>
          <div className={cx.card}>
            <h3 className={cx.cardTitle}>{t("breakdown.byModel")}</h3>
            <CostDonut
              title={t("breakdown.chartByModel")}
              segments={modelSegments(report.cost_by_model, t("breakdown.unknownModel"))}
            />
          </div>
        </div>
      )}
    </section>
  );
}
