import type { Severity } from "@devdigest/shared";
import type { SeverityCountMap } from "./SeverityChips";

/**
 * Group findings by severity — a plain COUNT over data already in memory.
 * No network, no LLM: every caller passes findings it has already fetched.
 *
 * The explicit three-way check mirrors the server's `rollupSeverities`, and is
 * what makes an unrecognised severity fall on the floor rather than invent a
 * bucket (or collide with a prototype key).
 */
export function countBySeverity(findings: { severity: string }[]): SeverityCountMap {
  const counts: SeverityCountMap = {};
  for (const f of findings) {
    if (f.severity === "CRITICAL" || f.severity === "WARNING" || f.severity === "SUGGESTION") {
      counts[f.severity as Severity] = (counts[f.severity as Severity] ?? 0) + 1;
    }
  }
  return counts;
}

/** Total across all buckets — 0 for null/undefined, so callers can branch on it. */
export function totalOf(counts: SeverityCountMap | null | undefined): number {
  if (!counts) return 0;
  return (counts.CRITICAL ?? 0) + (counts.WARNING ?? 0) + (counts.SUGGESTION ?? 0);
}
