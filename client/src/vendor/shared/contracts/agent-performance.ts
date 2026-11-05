import { z } from 'zod';

/**
 * L08 — Agent Performance. One aggregation, two reads:
 *   GET /agents/:id/stats?from&to&tz   → AgentStatsReport
 *   GET /agents/performance?from&to&tz → AgentPerformanceReport
 * Counted run = this workspace, status 'done', from <= ran_at < to. Every cost is a
 * DevDigest estimate (agent_runs.cost_usd); a run without a stored cost is never added in.
 * The previous window is [from − (to − from), from), counted by the same rules.
 * Supersedes the unused AgentStats (observability.ts) and AgentPerf (productionize.ts).
 */

/** An IANA name starts with a letter; a bare offset (`+05`, `+0530`) is rejected (Postgres reads it as POSIX, sign inverted). */
const TZ_SHAPE = /^[A-Za-z][A-Za-z0-9_+\-/]{0,63}$/;
/** Earliest instant either window may start at: 1970-01-01T00:00:00Z (keeps every bound inside what Postgres accepts). */
const MIN_WINDOW_START_MS = 0;
function isTimeZone(tz: string): boolean {
  if (!TZ_SHAPE.test(tz)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Querystring of both reads. ISO-8601 instants; start-inclusive, end-exclusive; IANA time zone for buckets. */
export const PerfRangeQuery = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
    tz: z.string().refine(isTimeZone, { message: 'unknown time zone' }),
    /** Sparkline grain (R-90): 'hour' only for the "1 day" preset. Ignored by the stats read. */
    bucket: z.enum(['hour', 'day']).default('day'),
  })
  .refine((q) => Date.parse(q.from) < Date.parse(q.to), { message: 'from must be before to', path: ['to'] })
  .refine((q) => 2 * Date.parse(q.from) - Date.parse(q.to) >= MIN_WINDOW_START_MS, {
    message: 'range starts too early: the previous window must not start before 1970-01-01',
    path: ['from'],
  });
export type PerfRangeQuery = z.infer<typeof PerfRangeQuery>;

/** The range the server applied (R-14) and the previous window of equal length (UX-02). */
export const AppliedRange = z.object({
  from: z.string(),
  to: z.string(),
  tz: z.string(),
  previous: z.object({ from: z.string(), to: z.string() }),
});
export type AppliedRange = z.infer<typeof AppliedRange>;

/** One agent's figures for a window — identical on both reads (R-01). */
export const AgentPerfFigures = z.object({
  runs: z.number().int().nonnegative(),
  priced_runs: z.number().int().nonnegative(),
  /** runs − priced_runs: counted, but never added into a cost (R-06). */
  unpriced_runs: z.number().int().nonnegative(),
  /** null when no counted run has a cost (R-07). */
  total_cost_usd: z.number().nullable(),
  avg_cost_usd: z.number().nullable(),
  avg_duration_ms: z.number().nullable(),
  accepted: z.number().int().nonnegative(),
  dismissed: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  /** accepted + dismissed — the accept-rate denominator. */
  decided: z.number().int().nonnegative(),
  /** accepted / decided, 0..1; null when decided = 0 (R-11). */
  accept_rate: z.number().nullable(),
  last_run_at: z.string().nullable(),
});
export type AgentPerfFigures = z.infer<typeof AgentPerfFigures>;

/** Current vs previous window. Unknown is null, never 0 (D-21, D-22). */
export const PerfComparison = z.object({
  previous_runs: z.number().int().nonnegative(),
  previous_total_cost_usd: z.number().nullable(),
  previous_decided: z.number().int().nonnegative(),
  previous_accept_rate: z.number().nullable(),
  /** current − previous total cost (estimate difference); null unless both are known. */
  cost_delta_usd: z.number().nullable(),
  /** whole-percent comparison of the two rates; null when either rate is unknown (R-96, R-97). */
  accept_trend: z.enum(['up', 'down', 'flat']).nullable(),
});
export type PerfComparison = z.infer<typeof PerfComparison>;

/** Cost of the counted priced runs of one provider+model; model null = "Unknown model" (R-22). */
export const PerfModelCost = z.object({
  provider: z.string().nullable(),
  model: z.string().nullable(),
  runs: z.number().int().nonnegative(),
  cost_usd: z.number(),
});
export type PerfModelCost = z.infer<typeof PerfModelCost>;

export const AgentStatsReport = z.object({
  range: AppliedRange,
  agent: z.object({ id: z.string(), name: z.string() }),
  figures: AgentPerfFigures,
  comparison: PerfComparison,
  /** cost desc, then label asc. */
  cost_by_model: z.array(PerfModelCost),
});
export type AgentStatsReport = z.infer<typeof AgentStatsReport>;

/**
 * A dashboard row: an existing agent, or every deleted agent's runs folded together (R-21).
 * Not named `AgentPerfRow`: that name is taken by productionize.ts:139 and both files share the barrel.
 */
export const AgentPerfTableRow = z.object({
  kind: z.enum(['agent', 'deleted']),
  /** null on the 'deleted' row. */
  agent_id: z.string().nullable(),
  agent_name: z.string().nullable(),
  enabled: z.boolean().nullable(),
  figures: AgentPerfFigures,
  comparison: PerfComparison,
  cost_by_model: z.array(PerfModelCost),
});
export type AgentPerfTableRow = z.infer<typeof AgentPerfTableRow>;

export const PerfAgentCost = z.object({
  kind: z.enum(['agent', 'deleted']),
  agent_id: z.string().nullable(),
  agent_name: z.string().nullable(),
  runs: z.number().int().nonnegative(),
  cost_usd: z.number(),
});
export type PerfAgentCost = z.infer<typeof PerfAgentCost>;

/** Counted runs of the current window per local hour/day; non-empty buckets only, key asc (UX-01). */
export const PerfRunBucket = z.object({
  /** 'YYYY-MM-DD' (day) or 'YYYY-MM-DDTHH' (hour), local to range.tz. */
  key: z.string(),
  runs: z.number().int().positive(),
});
export type PerfRunBucket = z.infer<typeof PerfRunBucket>;

export const AgentPerformanceReport = z.object({
  range: AppliedRange,
  totals: z.object({
    runs: z.number().int().nonnegative(),
    unpriced_runs: z.number().int().nonnegative(),
    total_cost_usd: z.number().nullable(),
    accepted: z.number().int().nonnegative(),
    decided: z.number().int().nonnegative(),
    /** pooled: Σ accepted / Σ decided over all rows; null when Σ decided = 0 (R-18). */
    accept_rate: z.number().nullable(),
    comparison: PerfComparison,
    bucket_unit: z.enum(['hour', 'day']),
    run_buckets: z.array(PerfRunBucket),
  }),
  /** an existing agent's id, or null (R-19, R-20). */
  most_active_agent_id: z.string().nullable(),
  /** every workspace agent (R-24), plus the 'deleted' row when it has a counted run in the current window. */
  agents: z.array(AgentPerfTableRow),
  /** priced runs only, cost desc (R-23, R-67). */
  cost_by_agent: z.array(PerfAgentCost),
  cost_by_model: z.array(PerfModelCost),
});
export type AgentPerformanceReport = z.infer<typeof AgentPerformanceReport>;
