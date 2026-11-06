/* perf-format.ts — formatting and banding rules shared by the Agent Performance
   dashboard and the agent Stats tab (L08), so the same figure reads the same on
   both screens (R-77). Costs use the house per-run format (`format-cost.ts`,
   R-51, Q-07). Pure: no React, no translations — labels are passed in. */
import { formatCostUsd } from "@/lib/format-cost";

/** Fewer decided findings than this is a small sample (R-61, BQ-4). */
export const SMALL_SAMPLE_DECIDED = 5;

/** A rate that rests on 1–4 decided findings. With none decided there is no rate to qualify. */
export function isSmallSample(decided: number): boolean {
  return decided > 0 && decided < SMALL_SAMPLE_DECIDED;
}

/**
 * The whole percent a 0..1 rate is displayed as; null (or NaN) stays null —
 * unknown, never "0%" (R-11). One rule for every rate on these screens: the
 * accept rate and the skill pull frequency (L08 skill-stats R-37, R-75).
 */
export function ratePercent(rate: number | null | undefined): number | null {
  return rate == null || Number.isNaN(rate) ? null : Math.round(rate * 100);
}

/** The accept rate's whole percent — `ratePercent` under the name its callers use. */
export const acceptPercent = ratePercent;

/** Milliseconds as seconds with one decimal ("6.2s"); unknown → "—" (R-54). */
export function formatDurationSec(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * A by-model segment's label (D-6): the model id, `provider/model` when the
 * same model id appears under two providers in `all`, `unknownLabel` when no
 * model was stored (R-22).
 */
export function segmentLabel(
  seg: { provider: string | null; model: string | null },
  all: readonly { provider: string | null; model: string | null }[],
  unknownLabel: string,
): string {
  if (seg.model == null) return unknownLabel;
  const providers = new Set(all.filter((s) => s.model === seg.model).map((s) => s.provider));
  return providers.size > 1 ? `${seg.provider ?? "?"}/${seg.model}` : seg.model;
}

/** A displayed percent at or above this is green (R-100). */
export const ACCEPT_BAND_GOOD = 70;
/** A displayed percent at or above this (and below GOOD) is amber; below it, red (R-100). */
export const ACCEPT_BAND_WARN = 50;

export type AcceptBand = "good" | "warn" | "bad" | "neutral";

/**
 * The colour band of an accept rate (D-23): neutral when the rate is unknown or
 * rests on fewer than 5 decided findings (R-101); otherwise by the displayed
 * whole percent — ≥ 70 good, 50–69 warn, < 50 bad (R-100).
 */
export function acceptBand(rate: number | null | undefined, decided: number): AcceptBand {
  const p = acceptPercent(rate);
  if (p === null || decided < SMALL_SAMPLE_DECIDED) return "neutral";
  if (p >= ACCEPT_BAND_GOOD) return "good";
  if (p >= ACCEPT_BAND_WARN) return "warn";
  return "bad";
}

/** Text colour per band. Neutral is the secondary text colour — never a band (R-101). */
export const ACCEPT_BAND_COLOR: Record<AcceptBand, string> = {
  good: "var(--ok)",
  warn: "var(--warn)",
  bad: "var(--crit)",
  neutral: "var(--text-secondary)",
};

/** U+2212 MINUS SIGN — typographically matches "+" in the signed delta. */
const MINUS = "−";

/**
 * The smallest cost the house format shows as a figure (`format-cost.ts` FLOOR):
 * anything below prints "<$0.0001". A delta below it is float noise or a
 * sub-display change, never a real "+"/"−" (F-11).
 */
export const COST_DELTA_EPSILON = 0.0001;

/** A known delta that displays as no change — exact 0 and |delta| below display precision alike (F-11). */
export function isCostUnchanged(usd: number | null | undefined): boolean {
  return usd != null && !Number.isNaN(usd) && Math.abs(usd) < COST_DELTA_EPSILON;
}

/**
 * A signed cost difference in the house format ("+$0.120", "−$1.200", D-21).
 * Unknown → null, so the caller shows nothing — never "$0" (R-95). A delta that
 * `isCostUnchanged` → null too: there is no sign to print; the caller shows its
 * neutral "no difference" text instead (F-11).
 */
export function formatCostDelta(usd: number | null | undefined): string | null {
  if (usd == null || Number.isNaN(usd) || isCostUnchanged(usd)) return null;
  return `${usd < 0 ? MINUS : "+"}${formatCostUsd(Math.abs(usd))}`;
}
