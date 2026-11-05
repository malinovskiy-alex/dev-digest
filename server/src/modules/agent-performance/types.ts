/**
 * agent-performance module (L08) — module-local types and the narrow read port
 * the service depends on. No import from `db/`: the repository maps its rows
 * into these shapes, so the pure folds in `helpers.ts` never see a Drizzle row.
 */

export type PerfBucketUnit = 'hour' | 'day';

/** The applied range: start-inclusive, end-exclusive (R-04); `tz` names the bucket zone (D-19). */
export interface PerfRange {
  from: Date;
  to: Date;
  tz: string;
  bucket: PerfBucketUnit;
}

/** Which window a counted run falls in: the applied range, or the one of equal length before it (D-20). */
export type PerfWindow = 'current' | 'previous';

/** One `GROUP BY win, agent_id, provider, model` row over counted runs (D-3a). */
export interface RunGroup {
  win: PerfWindow;
  /** null when the agent was deleted (agent_runs.agent_id is `on delete set null`). */
  agentId: string | null;
  provider: string | null;
  model: string | null;
  runs: number;
  /** count(cost_usd) */
  pricedRuns: number;
  /** sum(cost_usd); null when no run of the group has a cost. */
  costSum: number | null;
  /** count(duration_ms) */
  timedRuns: number;
  /** sum(duration_ms); null when no run of the group has a duration. */
  durationSum: number | null;
  lastRunAt: Date | null;
}

/** One `GROUP BY win, agent_runs.agent_id` row over the findings of counted runs (D-3b). */
export interface FindingTally {
  win: PerfWindow;
  agentId: string | null;
  accepted: number;
  /** dismissed and not accepted */
  dismissed: number;
  /** neither accepted nor dismissed */
  pending: number;
}

/** Counted runs of the current window in one local hour/day (D-18). */
export interface RunBucket {
  key: string;
  runs: number;
}

/** An existing workspace agent, as far as this module reads it. */
export interface PerfAgentRef {
  id: string;
  name: string;
  enabled: boolean;
}

/** The reads the service needs. `PerformanceRepository` implements it; tests may pass a fake. */
export interface PerformanceReadSource {
  /** Rejects with a `ValidationError` (422) when Postgres does not know `tz`; reads nothing. */
  assertTimeZoneKnown(tz: string): Promise<void>;
  listAgents(workspaceId: string): Promise<PerfAgentRef[]>;
  getAgent(workspaceId: string, agentId: string): Promise<PerfAgentRef | undefined>;
  /** Both windows (`previous.from` … `range.to`), tagged by `win`. */
  runGroups(workspaceId: string, range: PerfRange, agentId?: string): Promise<RunGroup[]>;
  /** Both windows, tagged by `win`. */
  findingTallies(workspaceId: string, range: PerfRange, agentId?: string): Promise<FindingTally[]>;
  /** Current window only; non-empty buckets, key asc. */
  runBuckets(workspaceId: string, range: PerfRange): Promise<RunBucket[]>;
}

export interface AgentPerformanceDeps {
  repo: PerformanceReadSource;
}
