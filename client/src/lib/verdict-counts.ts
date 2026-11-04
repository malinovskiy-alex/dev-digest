/** The verdict banner's two counts, shared by Agent runs and the PR Brief banner (R-79, R-83). */
import type { FindingRecord } from "@devdigest/shared";

/** Every finding, and the CRITICAL ones not dismissed. Deliberately not the PR list's severity tally. */
export function verdictCounts(findings: readonly Pick<FindingRecord, "severity" | "dismissed_at">[]): {
  findingsCount: number;
  blockers: number;
} {
  return {
    findingsCount: findings.length,
    blockers: findings.filter((f) => f.severity === "CRITICAL" && !f.dismissed_at).length,
  };
}
