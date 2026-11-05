/* AcceptRateValue — one accept rate as the dashboard row, the Avg accept KPI and
   the agent Stats tab all show it (R-49, R-53, R-77):
   - the whole percent, coloured by its band (R-100) — neutral on fewer than 5
     decided findings or an unknown rate (R-101); the text stays the value;
   - the denominator "<accepted>/<decided>" (row) or "<accepted>/<decided> decisions" (kpi);
   - "Small sample" under 5 decided findings (R-61, R-81);
   - unknown → "—" with "0 decisions" (row) or "No decided findings" (kpi);
   - with a `comparison`, the trend arrow (D-22): an `aria-hidden` icon plus the
     visually hidden "up from <p>%" / "down from <p>%" (R-96); nothing for
     `flat` or an unknown rate in either window (R-97, R-110). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon } from "@devdigest/ui";
import type { PerfComparison } from "@devdigest/shared";
import { ACCEPT_BAND_COLOR, acceptBand, acceptPercent, isSmallSample } from "@/lib/perf-format";
import { TREND_ICON_SIZE } from "./constants";
import { cx } from "./styles";

/** The fields an accept rate needs — a figures object or the dashboard totals. */
export interface AcceptRateFigures {
  accept_rate: number | null;
  accepted: number;
  decided: number;
}

export function AcceptRateValue({
  figures,
  comparison,
  variant,
}: {
  figures: AcceptRateFigures;
  comparison?: PerfComparison;
  variant: "row" | "kpi";
}): React.JSX.Element {
  const t = useTranslations("agentPerformance");
  const pct = acceptPercent(figures.accept_rate);
  const pctClass = variant === "kpi" ? cx.pctKpi : cx.pctRow;

  if (pct === null) {
    return (
      <span className={cx.wrap}>
        <span className={pctClass} style={{ color: ACCEPT_BAND_COLOR.neutral }}>
          —
        </span>
        <span className={cx.denom}>{variant === "kpi" ? t("kpi.noDecided") : t("table.zeroDecisions")}</span>
      </span>
    );
  }

  const color = ACCEPT_BAND_COLOR[acceptBand(figures.accept_rate, figures.decided)];
  const values = { accepted: figures.accepted, decided: figures.decided };
  return (
    <span className={cx.wrap}>
      <span className={pctClass} style={{ color }}>
        {pct}%
      </span>
      {comparison && <Trend comparison={comparison} />}
      <span className={cx.denom}>
        {variant === "kpi" ? t("kpi.decisions", values) : `${values.accepted}/${values.decided}`}
      </span>
      {isSmallSample(figures.decided) && <Badge color="var(--text-secondary)">{t("table.smallSample")}</Badge>}
    </span>
  );
}

function Trend({ comparison }: { comparison: PerfComparison }): React.JSX.Element | null {
  const t = useTranslations("agentPerformance");
  const prev = acceptPercent(comparison.previous_accept_rate);
  const trend = comparison.accept_trend;
  if (prev === null || (trend !== "up" && trend !== "down")) return null;
  const Arrow = trend === "up" ? Icon.ArrowUp : Icon.ArrowDown;
  return (
    <span className={cx.trend}>
      <Arrow size={TREND_ICON_SIZE} aria-hidden="true" />
      <span className={cx.srOnly}>{t(trend === "up" ? "table.trendUp" : "table.trendDown", { p: prev })}</span>
    </span>
  );
}
