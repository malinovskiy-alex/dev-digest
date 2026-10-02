import type { IntentSource } from "@devdigest/shared";
import { ApiError } from "@/lib/api";
import { KNOWN_REASONS, RISK_ICON_FALLBACK, RISK_ICON_RULES, SHORT_SHA_LENGTH, type KnownReason } from "./constants";

/** Pure helpers for the PR intent card. */

/** 409 `intent_unavailable` = no key for the intent model: a state to explain, not an error to retry. */
export function isIntentUnavailable(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409;
}

/** 404 `intent_not_derived` = nobody asked yet: the card offers the "Derive intent" button. */
export function isIntentNotDerived(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404 && err.code === "intent_not_derived";
}

export function shortSha(sha: string | null | undefined): string | null {
  return sha ? sha.slice(0, SHORT_SHA_LENGTH) : null;
}

/** The reason as a translatable key, or null when the server sent one we have no label for. */
export function knownReason(reason: string | null | undefined): KnownReason | null {
  if (!reason) return null;
  return (KNOWN_REASONS as readonly string[]).includes(reason) ? (reason as KnownReason) : null;
}

/** A parseable date for the "derived …" line, or null. */
export function derivedAt(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t);
}

/**
 * Tickets and specs the author referenced that the intent could not fully use
 * (failed, not fetched, or truncated). Mirrors `missingContext` on the server,
 * so the card and the review prompt name the same gaps.
 */
export function missingContext(sources: IntentSource[]): IntentSource[] {
  return sources.filter(
    (s) => (s.type === "ticket" || s.type === "spec") && (s.status !== "used" || s.reason === "truncated"),
  );
}

/** Icon + colour for a risk-area chip, from keywords in its label. */
export function riskIcon(area: string): { icon: (typeof RISK_ICON_FALLBACK)["icon"]; className: string } {
  const rule = RISK_ICON_RULES.find((r) => r.pattern.test(area));
  return rule ? { icon: rule.icon, className: rule.className } : RISK_ICON_FALLBACK;
}
