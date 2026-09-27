import { ApiError } from "@/lib/api";
import { KNOWN_REASONS, SHORT_SHA_LENGTH, type KnownReason } from "./constants";

/** Pure helpers for the PR intent card. */

/** 409 `intent_unavailable` = no key for the intent model: a state to explain, not an error to retry. */
export function isIntentUnavailable(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409;
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
