import type { RiskSeverity } from "@devdigest/shared";

/** Constants for the PR Brief's Risk areas list. */

/** A risk file ref: `<path>`, `<path>:<n>` or `<path>:<a>-<b>` — the client mirror of R-32 (display only). */
export const RISK_REF_RE = /^([^:\s][^:]*?)(?::([1-9]\d*)(?:-([1-9]\d*))?)?$/;

/** Colour of the severity dot; the severity is also said in visually-hidden text (R-49). */
export const SEVERITY_DOT: Record<RiskSeverity, string> = {
  high: "bg-[var(--crit)]",
  medium: "bg-[var(--warn)]",
  low: "bg-[var(--text-muted)]",
};
