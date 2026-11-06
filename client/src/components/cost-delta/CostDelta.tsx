/* CostDelta — the signed cost difference against the previous window of equal
   length, "+$0.120 estimate difference vs previous period" (R-94, R-107, D-21).
   Renders nothing unless both totals are known — never "$0", never a
   difference against 0 (R-95, R-108). A known delta below display precision
   (exact 0 or float noise) reads "No estimate difference vs previous period",
   never a signed "<$0.0001" (F-11). Neutral colour: a cost change is not
   judged good or bad. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { PerfComparison } from "@devdigest/shared";
import { formatCostDelta, isCostUnchanged } from "@/lib/perf-format";
import { cx } from "./styles";

export function CostDelta({ comparison }: { comparison: PerfComparison }): React.JSX.Element | null {
  const t = useTranslations("agentPerformance");
  if (isCostUnchanged(comparison.cost_delta_usd)) {
    return <span className={cx.wrap}>{t("estimate.noChange")}</span>;
  }
  const delta = formatCostDelta(comparison.cost_delta_usd);
  if (delta === null) return null;
  return (
    <span className={cx.wrap}>
      <span className={cx.value}>{delta}</span>
      <span>{t("estimate.deltaLabel")}</span>
    </span>
  );
}
