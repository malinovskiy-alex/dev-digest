import type { BlastDegradedReason, BlastRadius } from "@devdigest/shared";
import { DEGRADED_REASONS } from "./constants";

/** Why the card shows the "Index incomplete" badge. */
export interface IndexNotice {
  reason: BlastDegradedReason;
}

function knownReason(r: string | null | undefined): BlastDegradedReason {
  return (DEGRADED_REASONS as readonly string[]).includes(r ?? "")
    ? (r as BlastDegradedReason)
    : "no_data";
}

/**
 * The badge, or null when the map is served from a full index. A degraded map
 * says why itself; a partial or failed index the facade still served as
 * non-degraded is flagged from `index_status`.
 */
export function indexNotice(
  b: Pick<BlastRadius, "degraded" | "reason" | "index_status">,
): IndexNotice | null {
  if (b.degraded) return { reason: knownReason(b.reason) };
  switch (b.index_status) {
    case "partial":
      return { reason: "index_partial" };
    case "failed":
      return { reason: "index_failed" };
    case "degraded":
      return { reason: "no_data" };
    default:
      return null;
  }
}

/** Caller lines come from the index, so links pin the indexed commit; else the PR head (D7). */
export function linkSha(b: Pick<BlastRadius, "indexed_sha">, headSha: string): string {
  return b.indexed_sha ?? headSha;
}
