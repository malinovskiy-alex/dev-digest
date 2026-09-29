import type { IconName } from "@devdigest/ui";
import type { IntentConfidence, IntentSource } from "@devdigest/shared";

/** Constants for the PR intent card (L03). */

/** How many characters of the head sha the "derived … for abc1234" line shows. */
export const SHORT_SHA_LENGTH = 7;

/** Refresh the "derived 3m ago" line once a minute. */
export const AGE_TICK_MS = 60_000;

/**
 * Badge colours per confidence level. `low` is the warning colour on purpose:
 * it means "a guess from indirect signals" and the reader should know that
 * before trusting the scope below it.
 */
export const CONFIDENCE_TONE: Record<IntentConfidence, { color: string; bg: string; icon: IconName }> = {
  high: { color: "var(--ok)", bg: "var(--ok-bg)", icon: "CheckCircle" },
  medium: { color: "var(--accent-text)", bg: "var(--accent-bg)", icon: "Info" },
  low: { color: "var(--warn)", bg: "var(--warn-bg)", icon: "AlertTriangle" },
};

/** Icon + colour per source status: ✓ used, ✗ not read, ? deliberately not fetched. */
export const SOURCE_STATUS_TONE: Record<IntentSource["status"], { icon: IconName; className: string }> = {
  used: { icon: "Check", className: "text-[var(--ok)]" },
  failed: { icon: "X", className: "text-[var(--crit)]" },
  unresolved: { icon: "Info", className: "text-[var(--text-muted)]" },
};

/**
 * Reasons the server emits that have a translated label (`brief.intent.reason.*`).
 * Anything else is shown as the raw code rather than hidden.
 */
export const KNOWN_REASONS = [
  "empty",
  "template_only",
  "not_found",
  "too_large",
  "outside_repo",
  "external",
  "limit_exceeded",
  "fetch_failed",
  "github_unavailable",
] as const;
export type KnownReason = (typeof KNOWN_REASONS)[number];

/**
 * Risk-area chip icon, picked from the label the model wrote. First match wins;
 * the fallback is the neutral warning triangle. Colour only on the icon — the
 * chip itself stays neutral so a long list does not read as a wall of alerts.
 */
export const RISK_ICON_RULES: { pattern: RegExp; icon: IconName; className: string }[] = [
  { pattern: /auth|token|secret|credential|password|permission|security|vulnerab|injection/i, icon: "Shield", className: "text-[var(--crit)]" },
  { pattern: /dependenc|package|library|upgrade|version/i, icon: "Boxes", className: "text-[var(--warn)]" },
  { pattern: /perf|latency|round-trip|slow|n\+1|query|throughput|memory|cache/i, icon: "Zap", className: "text-[var(--text-muted)]" },
  { pattern: /migration|schema|database|\bdb\b|data loss/i, icon: "Database", className: "text-[var(--warn)]" },
];
export const RISK_ICON_FALLBACK = { icon: "AlertTriangle" as IconName, className: "text-[var(--text-muted)]" };
