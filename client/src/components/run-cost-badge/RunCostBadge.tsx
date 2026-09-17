/* What one review run cost. Two variants, one for each place a run is listed:
   `compact` for the PR list's Cost cell, `detailed` for the PR-detail timeline
   (tokens + cost under the timestamp). The run-trace drawer uses its own Stat
   tile and only borrows formatCostUsd. */
"use client";

import { useTranslations } from "next-intl";
import { formatCostUsd, formatTokensTotal } from "@/lib/format-cost";

export interface RunCostBadgeProps {
  /** USD for the run. null = unknown price (or no run yet) — never treated as free. */
  costUsd: number | null | undefined;
  tokensIn?: number | null;
  tokensOut?: number | null;
  /** `compact`: "$0.014". `detailed`: "9,119 tok · $0.0013". */
  variant?: "compact" | "detailed";
}

/**
 * Renders as plain tabular-numeral text, not a Badge pill: every mockup draws
 * it inline, and a pill in the list column would collide with the Status badge
 * sitting next to it.
 */
export function RunCostBadge({
  costUsd,
  tokensIn,
  tokensOut,
  variant = "compact",
}: RunCostBadgeProps) {
  const t = useTranslations("common");
  const cost = formatCostUsd(costUsd);

  if (variant === "compact") {
    // A table cell must not collapse, so an unknown cost still renders "—".
    return (
      <span className="tnum" style={{ color: "var(--text-muted)" }}>
        {cost}
      </span>
    );
  }

  const tokens = formatTokensTotal(tokensIn, tokensOut);
  // Nothing to report (an errored run) → render nothing, as in the mockup.
  if (tokens == null && costUsd == null) return null;

  return (
    <span className="tnum" style={{ color: "var(--text-muted)" }}>
      {tokens != null ? `${tokens} ${t("cost.tokensSuffix")} · ` : ""}
      {cost}
    </span>
  );
}

export default RunCostBadge;
