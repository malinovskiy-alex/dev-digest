/* FindingsWidget — findings by category and severity, one component for the
   agent Stats tab and the skill Stats tab (L08 skill-stats R-59 … R-70, D-10).

   - no finding → only `emptyLabel` ("No findings in <range>", R-65);
   - else a ring by category with the total in its centre (R-60), a legend of
     security, bug, perf, style, test (zeros too) and `other` only above 0, each
     "count · p%" (R-61, R-62); a severity row CRITICAL, WARNING, SUGGESTION
     (zeros too) and `other` only above 0, in the house severity colour and icon
     (R-63); "Small sample" for 1 … 4 findings (R-64).
   Percentages are whole and per entry, so they may add up to 99–101 (R-62).
   The figures come from the tab's own read — no request here (R-70). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon, SEV } from "@devdigest/ui";
import type { FindingsBreakdown } from "@devdigest/shared";
import { CategoryDonut } from "./_components/CategoryDonut";
import { CATEGORY_COLOR, SEVERITY_ICON_SIZE, type WidgetSeverity } from "./constants";
import { categoryEntries, isSmallFindingsSample, severityEntries } from "./helpers";
import { cx } from "./styles";

/** The house token per severity; a stored value outside the enum reads as INFO's neutral. */
function severityToken(sev: WidgetSeverity) {
  return sev === "other" ? SEV.INFO : SEV[sev];
}

export function FindingsWidget({
  findings,
  emptyLabel,
}: {
  findings: FindingsBreakdown;
  emptyLabel: string;
}): React.JSX.Element {
  const t = useTranslations("agentPerformance");

  if (findings.total === 0) return <p className={cx.empty}>{emptyLabel}</p>;

  const segments = categoryEntries(findings).map((e) => ({
    key: e.key,
    label: t(`findings.category.${e.key}`),
    count: e.count,
    text: t("findings.entry", { count: e.count, pct: e.pct }),
    color: CATEGORY_COLOR[e.key],
  }));

  return (
    <section className={cx.card} aria-label={t("findings.title")}>
      <div className={cx.header}>
        <h3 className={cx.title}>{t("findings.title")}</h3>
        {isSmallFindingsSample(findings.total) && (
          <Badge color="var(--text-secondary)">{t("findings.smallSample")}</Badge>
        )}
      </div>
      <CategoryDonut title={t("findings.chartLabel")} total={findings.total} segments={segments} />
      <ul className={cx.severityRow} aria-label={t("findings.severityLabel")}>
        {severityEntries(findings).map((e) => {
          const token = severityToken(e.key);
          const SevIcon = Icon[token.icon];
          return (
            <li key={e.key} className={cx.severityItem} style={{ color: token.c }}>
              <SevIcon size={SEVERITY_ICON_SIZE} aria-hidden="true" />
              <span>{t(`findings.severity.${e.key}`)}</span>
              <span className={cx.severityValue}>{t("findings.entry", { count: e.count, pct: e.pct })}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
