/* Findings counted by severity, in the two shapes the app needs.

   Read-only (no `onToggle`) renders the vendored <SeverityBadge compact> — icon
   + count — which is exactly what the design reference draws in the PR list's
   Findings cell and on the timeline tiles.

   Interactive (with `onToggle`) renders pills: icon + count + LABEL, as in
   "2 CRITICAL · 3 WARNING". These are hand-rolled rather than borrowed from
   <SeverityBadge> for two reasons: it orders its parts icon → label → count
   ("CRITICAL 2"), and it is a <span>, which cannot carry aria-pressed. The
   colours still come from the same SEV tokens, so the severity → colour mapping
   stays single-sourced and src/vendor/ui is left untouched.

   There is no useTranslations here on purpose: labels come from SEV[sev].label,
   and a pill's accessible name is its own visible text. That keeps the most
   widely reused of these components out of the next-intl missing-namespace trap
   (see client/INSIGHTS.md). */
"use client";

import React from "react";
import { Icon, SeverityBadge, SEV, type Severity as UiSeverity } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";
import { SEVERITY_DISPLAY_ORDER } from "./constants";
import { s } from "./styles";

/** Counts per severity. A missing key and a 0 mean the same: don't render it. */
export type SeverityCountMap = Partial<Record<Severity, number>>;

export interface SeverityChipsProps {
  counts: SeverityCountMap | null | undefined;
  /** Present ⇒ chips are toggle buttons with labels. Absent ⇒ read-only badges. */
  onToggle?: (severity: Severity) => void;
  /** Which chip reads as pressed. Only meaningful alongside `onToggle`. */
  active?: Severity | null;
  /** Rendered instead of the row when every bucket is empty. */
  emptyFallback?: React.ReactNode;
  /** Interleave a muted "·" between chips (the run-card filter row). */
  separator?: boolean;
}

export function SeverityChips({
  counts,
  onToggle,
  active = null,
  emptyFallback = null,
  separator = false,
}: SeverityChipsProps) {
  const present = SEVERITY_DISPLAY_ORDER.filter((sev) => (counts?.[sev] ?? 0) > 0);
  if (present.length === 0) return <>{emptyFallback}</>;

  return (
    <span style={s.row}>
      {present.map((sev, i) => {
        const count = counts![sev]!;
        // The contract's Severity (3 values) is a strict subset of the UI token
        // map's (4 — it also has INFO, which the API cannot emit), so indexing
        // SEV and widening for SeverityBadge is sound.
        const token = SEV[sev as UiSeverity];
        const I = Icon[token.icon];
        return (
          <React.Fragment key={sev}>
            {separator && i > 0 && <span style={s.separator}>·</span>}
            {onToggle ? (
              <button
                type="button"
                aria-pressed={active === sev}
                onClick={() => onToggle(sev)}
                style={{
                  ...s.pill(token.c, token.bg, active != null && active !== sev),
                  ...(active === sev ? s.pillActiveRing(token.c) : null),
                }}
              >
                <I size={12.5} />
                <span className="tnum">{count}</span>
                {token.label}
              </button>
            ) : (
              // The compact badge hides its label, so carry it in `title` —
              // otherwise the count is colour-coded only.
              <span title={`${count} ${token.label}`} style={s.readOnlyChip}>
                <SeverityBadge severity={sev as UiSeverity} count={count} compact />
              </span>
            )}
          </React.Fragment>
        );
      })}
    </span>
  );
}

export default SeverityChips;
