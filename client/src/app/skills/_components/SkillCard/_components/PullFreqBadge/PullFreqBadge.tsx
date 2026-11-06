/* PullFreqBadge — "<N> agents · <p>% pull freq" on a skill card (L08
   skill-stats R-71, R-75 … R-77, D-11):
   - ready → "2 agents · 100% pull freq", or "2 agents · — pull freq" when no PR
     was reviewed in the 30 days (never "0%");
   - loading → the count at once and a placeholder, no digit;
   - failed or not given → the count only, no per-card error.
   The hint that explains the figure belongs to the card (`PullFreqHint`), so it
   is announced once, as the card's description (R-83). Hovering this badge is
   what shows it (F-18): the wrapper's `data-pull-freq-badge` is the hint's
   hover target. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@devdigest/ui";
import { ratePercent } from "@/lib/perf-format";
import { SEPARATOR } from "./constants";
import { cx } from "./styles";

/**
 * A card's pull frequency (D-11): loading shows a placeholder, a failed read
 * shows the agent count only (R-76, R-77), ready carries the rate — `null`
 * when no PR was reviewed in the 30 days (R-75).
 */
export type CardPullFreq = { status: "loading" } | { status: "error" } | { status: "ready"; rate: number | null };

export function PullFreqBadge({
  agentCount,
  pullFrequency,
}: {
  agentCount: number;
  pullFrequency: CardPullFreq | undefined;
}): React.JSX.Element {
  const t = useTranslations("skills");
  const agents = t("listItem.agents", { count: agentCount });

  let freq: React.ReactNode = null;
  if (pullFrequency?.status === "loading") {
    freq = (
      <>
        {SEPARATOR}
        <span aria-hidden="true" className={cx.placeholder} />
        <span className={cx.srOnly}>{t("listItem.pullFreqLoading")}</span>
      </>
    );
  } else if (pullFrequency?.status === "ready") {
    const pct = ratePercent(pullFrequency.rate);
    freq = (
      <>
        {SEPARATOR}
        {pct === null ? t("listItem.pullFreqUnknown") : t("listItem.pullFreq", { pct })}
      </>
    );
  }

  return (
    // `Badge` takes no attributes, so the hover target is this wrapper.
    <span data-pull-freq-badge="" className={cx.hoverTarget}>
      <Badge color="var(--text-secondary)" icon="Cpu">
        {agents}
        {freq}
      </Badge>
    </span>
  );
}
