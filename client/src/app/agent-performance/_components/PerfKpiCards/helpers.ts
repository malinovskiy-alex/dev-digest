/* Pure derivations for the KPI cards. */
import type { AgentPerformanceReport, AgentPerfTableRow } from "@devdigest/shared";
import { fillBuckets } from "@/lib/perf-range";

/** Sparkline points over the range the server applied, in its time zone (R-90, R-91, D-18). */
export function sparklinePoints(report: AgentPerformanceReport): number[] {
  const { range, totals } = report;
  return fillBuckets(
    { from: new Date(range.from), to: new Date(range.to) },
    totals.bucket_unit,
    totals.run_buckets,
    range.tz,
  );
}

/** The Most-active agent's row, or null (R-19, R-20, R-50). */
export function mostActiveRow(report: AgentPerformanceReport): AgentPerfTableRow | null {
  const id = report.most_active_agent_id;
  if (!id) return null;
  return report.agents.find((r) => r.kind === "agent" && r.agent_id === id) ?? null;
}
