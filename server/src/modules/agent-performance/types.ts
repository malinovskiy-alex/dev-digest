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

/**
 * One `GROUP BY win, agent_runs.agent_id, findings.category, findings.severity` row
 * over the findings of counted runs (L08 skill-stats D-5). A `FindingTally` split
 * further by category and severity, so it folds through `foldFigures` unchanged
 * (F-11, F-13). `category` / `severity` are the stored text, folded to the contract
 * enums in `helpers.ts`.
 */
export interface BreakdownRow extends FindingTally {
  category: string;
  severity: string;
}

/** Which windows a breakdown read spans: the skill reads need only the current one. */
export type BreakdownWindows = 'current' | 'both';

/** Counted runs of one agent in the current window (L08 skill-stats R-06, R-79). */
export interface AgentRunCount {
  agentId: string;
  runs: number;
}

/** An existing workspace skill, as far as this module reads it. */
export interface PerfSkillRef {
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
  /** A skill of this workspace, or undefined (unknown or foreign id). */
  getSkill(workspaceId: string, skillId: string): Promise<PerfSkillRef | undefined>;
  /** Every skill id of this workspace, name asc then id. */
  listSkillIds(workspaceId: string): Promise<string[]>;
  /** Agents using the skill now (active-skill gate, both workspace checks), name asc then id (D-4). */
  usingAgents(workspaceId: string, skillId: string): Promise<PerfAgentRef[]>;
  /** Current window only; agents without a counted run are absent. `[]` ids → `[]`, no query. */
  runCountsByAgent(workspaceId: string, range: PerfRange, agentIds: string[]): Promise<AgentRunCount[]>;
  /**
   * Per window, agent, category, severity — the current window only unless `windows`
   * is 'both' (the agent Stats read, which also needs the previous window's tallies).
   * `[]` ids → `[]`, no query.
   */
  findingBreakdown(
    workspaceId: string,
    range: PerfRange,
    agentIds: string[],
    windows?: BreakdownWindows,
  ): Promise<BreakdownRow[]>;
  /** Current window only: distinct non-null PRs with a counted run, deleted agents included (R-07). */
  reviewedPrCount(workspaceId: string, range: PerfRange): Promise<number>;
  /**
   * Current window only: per skill id, distinct non-null PRs with a counted run of an
   * agent using the skill now (R-08). Skills without such a PR are absent.
   */
  prsWithSkill(workspaceId: string, range: PerfRange, skillId?: string): Promise<Map<string, number>>;
}

export interface AgentPerformanceDeps {
  repo: PerformanceReadSource;
}
