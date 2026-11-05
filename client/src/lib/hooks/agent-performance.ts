/* hooks/agent-performance.ts — React Query reads for the Agent Performance
   dashboard and the agent Stats tab (L08). Both are plain GETs over stored rows
   (R-29, R-74, R-83): no mutation, no polling.

   Each range is its own query key and there is no `placeholderData`, so while a
   new range loads the screen shows its skeleton, never the previous range's
   figures under the new label (R-41). Both reads send the same query string
   (`from`, `to`, `tz`, `bucket`, D-19); the stats read ignores `bucket`. Imported
   directly, not through the hooks barrel (D-15). */
"use client";

import { useQuery } from "@tanstack/react-query";
import type { AgentPerformanceReport, AgentStatsReport } from "@devdigest/shared";
import { api } from "@/lib/api";
import { browserTimeZone, perfRangeQuery, type PerfBucketUnit, type PerfRange } from "@/lib/perf-range";

export const agentPerformanceKey = (from: string, to: string, tz: string, bucket: PerfBucketUnit) =>
  ["agent-performance", from, to, tz, bucket] as const;

export const agentStatsKey = (agentId: string, from: string, to: string, tz: string) =>
  ["agent-stats", agentId, from, to, tz] as const;

/** The dashboard read for one applied range (R-26); `bucket` is the sparkline grain (R-90). */
export function useAgentPerformance(range: PerfRange, bucket: PerfBucketUnit) {
  const tz = browserTimeZone();
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  return useQuery({
    queryKey: agentPerformanceKey(from, to, tz, bucket),
    queryFn: () => api.get<AgentPerformanceReport>(`/agents/performance?${perfRangeQuery(range, tz, bucket)}`),
  });
}

/** One agent's figures for one applied range (R-25) — the same rules as its dashboard row (R-01). */
export function useAgentStats(agentId: string, range: PerfRange) {
  const tz = browserTimeZone();
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  return useQuery({
    queryKey: agentStatsKey(agentId, from, to, tz),
    queryFn: () =>
      api.get<AgentStatsReport>(`/agents/${encodeURIComponent(agentId)}/stats?${perfRangeQuery(range, tz, "day")}`),
    enabled: !!agentId,
  });
}
