import { and, asc, eq, gte, inArray, isNotNull, lt, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { activeSkillOnAgent } from '../../db/skill-gates.js';
import { ValidationError } from '../../platform/errors.js';
import * as t from '../../db/schema.js';
import { BUCKET_SQL, COUNTED_RUN_STATUS } from './constants.js';
import { previousWindow } from './helpers.js';
import type {
  AgentRunCount,
  BreakdownRow,
  BreakdownWindows,
  FindingTally,
  PerfAgentRef,
  PerfRange,
  PerfSkillRef,
  PerformanceReadSource,
  PerfWindow,
  RunBucket,
  RunGroup,
} from './types.js';

/**
 * agent-performance data access (L08). **Read-only** over six tables this
 * module does not own — `agents`, `agent_runs`, `reviews`, `findings` (D-5),
 * and, for the skill reads (L08 skill-stats), `skills` and `agent_skills`.
 * Nothing here inserts, updates or deletes. Every statement is scoped to the
 * caller's workspace (R-30, skill-stats R-25), and joins re-check the workspace
 * on `reviews`, `agents` and `skills`. All values are bound; no `sql.raw`.
 *
 * A "counted run" is: this workspace, status 'done', `from <= ran_at < to`,
 * any source (R-02…R-04, Q-01). Group reads span both windows in one statement
 * and tag each run with `win` (D-20), so the previous window is counted by
 * exactly the same predicate as the current one.
 */
export class PerformanceRepository implements PerformanceReadSource {
  constructor(private db: Db) {}

  /** `agentId`: one agent, or a list (a non-empty one — `inArray([])` is invalid SQL). */
  private countedRunsWhere(workspaceId: string, from: Date, to: Date, agentId?: string | string[]): SQL | undefined {
    return and(
      eq(t.agentRuns.workspaceId, workspaceId),
      eq(t.agentRuns.status, COUNTED_RUN_STATUS),
      gte(t.agentRuns.ranAt, from),
      lt(t.agentRuns.ranAt, to),
      Array.isArray(agentId)
        ? inArray(t.agentRuns.agentId, agentId)
        : agentId
          ? eq(t.agentRuns.agentId, agentId)
          : undefined,
    );
  }

  /** Counted runs of both windows (or the current one only), with their window tag, as a CTE. */
  private countedRuns(
    workspaceId: string,
    range: PerfRange,
    agentId?: string | string[],
    windows: BreakdownWindows = 'both',
  ) {
    const from = windows === 'both' ? previousWindow(range).from : range.from;
    return this.db.$with('counted').as(
      this.db
        .select({
          id: t.agentRuns.id,
          win: sql<PerfWindow>`case when ${t.agentRuns.ranAt} >= ${range.from.toISOString()}::timestamptz then 'current' else 'previous' end`.as(
            'win',
          ),
          agentId: t.agentRuns.agentId,
          provider: t.agentRuns.provider,
          model: t.agentRuns.model,
          costUsd: t.agentRuns.costUsd,
          durationMs: t.agentRuns.durationMs,
          ranAt: t.agentRuns.ranAt,
        })
        .from(t.agentRuns)
        .where(this.countedRunsWhere(workspaceId, from, range.to, agentId)),
    );
  }

  async runGroups(workspaceId: string, range: PerfRange, agentId?: string): Promise<RunGroup[]> {
    const c = this.countedRuns(workspaceId, range, agentId);
    // Costs are summed as numeric: exact and order-independent, so the stats read
    // and the dashboard read get bit-identical sums whatever plan Postgres picks (R-01).
    const rows = await this.db
      .with(c)
      .select({
        win: c.win,
        agentId: c.agentId,
        provider: c.provider,
        model: c.model,
        runs: sql<number>`count(*)::int`,
        pricedRuns: sql<number>`count(${c.costUsd})::int`,
        costSum: sql<number | null>`sum(${c.costUsd}::numeric)::float8`,
        timedRuns: sql<number>`count(${c.durationMs})::int`,
        durationSum: sql<number | null>`sum(${c.durationMs})::float8`,
        lastRunAt: sql<Date | null>`max(${c.ranAt})`.mapWith(t.agentRuns.ranAt),
      })
      .from(c)
      .groupBy(c.win, c.agentId, c.provider, c.model);
    return rows.map((r) => ({ ...r, lastRunAt: r.lastRunAt ?? null }));
  }

  /**
   * THE finding-state split, shared by `findingTallies` and `findingBreakdown` so
   * the agent figures and the skill figures count states by one SQL text
   * (skill-stats D-5, REC-2): accepted wins over dismissed; pending is neither.
   */
  private findingStateColumns() {
    return {
      accepted: sql<number>`count(*) filter (where ${t.findings.acceptedAt} is not null)::int`,
      dismissed: sql<number>`count(*) filter (where ${t.findings.acceptedAt} is null and ${t.findings.dismissedAt} is not null)::int`,
      pending: sql<number>`count(*) filter (where ${t.findings.acceptedAt} is null and ${t.findings.dismissedAt} is null)::int`,
    };
  }

  async findingTallies(workspaceId: string, range: PerfRange, agentId?: string): Promise<FindingTally[]> {
    const c = this.countedRuns(workspaceId, range, agentId);
    // Every finding kind counts (Q-04); state is read as it is now (R-10).
    return this.db
      .with(c)
      .select({
        win: c.win,
        agentId: c.agentId,
        ...this.findingStateColumns(),
      })
      .from(c)
      .innerJoin(t.reviews, and(eq(t.reviews.runId, c.id), eq(t.reviews.workspaceId, workspaceId)))
      .innerJoin(t.findings, eq(t.findings.reviewId, t.reviews.id))
      .groupBy(c.win, c.agentId);
  }

  async runBuckets(workspaceId: string, range: PerfRange): Promise<RunBucket[]> {
    // Unit and format come from the two-entry constant map (keyed by the zod
    // enum), the zone from validated input — all three as bound parameters.
    const { unit, fmt } = BUCKET_SQL[range.bucket];
    const local = this.db.$with('local_runs').as(
      this.db
        .select({
          key: sql<string>`to_char(date_trunc(${unit}::text, ${t.agentRuns.ranAt} at time zone ${range.tz}::text), ${fmt}::text)`.as(
            'key',
          ),
        })
        .from(t.agentRuns)
        .where(this.countedRunsWhere(workspaceId, range.from, range.to)),
    );
    return mapUnknownTimeZone(range.tz, () =>
      this.db
        .with(local)
        .select({ key: local.key, runs: sql<number>`count(*)::int` })
        .from(local)
        .groupBy(local.key)
        .orderBy(asc(local.key)),
    );
  }

  /**
   * Asks Postgres whether it knows `tz` — one row, no table, no workspace. Run
   * before the reads on both routes, so a zone Node's Intl accepts but
   * Postgres's tz database does not (e.g. 'US/Pacific-New') is a 422 whatever
   * the data, not only when the current window has runs (F-09).
   */
  async assertTimeZoneKnown(tz: string): Promise<void> {
    await mapUnknownTimeZone(tz, () => this.db.execute(sql`select now() at time zone ${tz}::text`));
  }

  async listAgents(workspaceId: string): Promise<PerfAgentRef[]> {
    return this.db
      .select({ id: t.agents.id, name: t.agents.name, enabled: t.agents.enabled })
      .from(t.agents)
      .where(eq(t.agents.workspaceId, workspaceId))
      .orderBy(asc(t.agents.name), asc(t.agents.id));
  }

  async getAgent(workspaceId: string, agentId: string): Promise<PerfAgentRef | undefined> {
    const [row] = await this.db
      .select({ id: t.agents.id, name: t.agents.name, enabled: t.agents.enabled })
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.id, agentId)))
      .limit(1);
    return row;
  }

  // ---- L08 skill-stats reads (current window only) ----

  async getSkill(workspaceId: string, skillId: string): Promise<PerfSkillRef | undefined> {
    const [row] = await this.db
      .select({ id: t.skills.id, name: t.skills.name, enabled: t.skills.enabled })
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, skillId)))
      .limit(1);
    return row;
  }

  async listSkillIds(workspaceId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: t.skills.id })
      .from(t.skills)
      .where(eq(t.skills.workspaceId, workspaceId))
      .orderBy(asc(t.skills.name), asc(t.skills.id));
    return rows.map((r) => r.id);
  }

  /** "Uses the skill" = the active-skill gate, evaluated now (skill-stats D-4, R-01, R-02). */
  async usingAgents(workspaceId: string, skillId: string): Promise<PerfAgentRef[]> {
    return this.db
      .select({ id: t.agents.id, name: t.agents.name, enabled: t.agents.enabled })
      .from(t.agentSkills)
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .where(
        and(
          eq(t.agentSkills.skillId, skillId),
          activeSkillOnAgent(),
          eq(t.agents.workspaceId, workspaceId),
          eq(t.skills.workspaceId, workspaceId),
        ),
      )
      .orderBy(asc(t.agents.name), asc(t.agents.id));
  }

  async runCountsByAgent(workspaceId: string, range: PerfRange, agentIds: string[]): Promise<AgentRunCount[]> {
    // `inArray` with an empty list is invalid SQL: no agent, no query (D-8).
    if (agentIds.length === 0) return [];
    const rows = await this.db
      .select({ agentId: t.agentRuns.agentId, runs: sql<number>`count(*)::int` })
      .from(t.agentRuns)
      .where(and(this.countedRunsWhere(workspaceId, range.from, range.to), inArray(t.agentRuns.agentId, agentIds)))
      .groupBy(t.agentRuns.agentId);
    return rows.flatMap((r) => (r.agentId === null ? [] : [{ agentId: r.agentId, runs: r.runs }]));
  }

  async findingBreakdown(
    workspaceId: string,
    range: PerfRange,
    agentIds: string[],
    windows: BreakdownWindows = 'current',
  ): Promise<BreakdownRow[]> {
    if (agentIds.length === 0) return [];
    // Same counted-run CTE and the same state split as `findingTallies`, one level
    // finer (R-16, R-26); every finding kind and state counts (BQ-3).
    const c = this.countedRuns(workspaceId, range, agentIds, windows);
    return this.db
      .with(c)
      .select({
        win: c.win,
        agentId: c.agentId,
        category: t.findings.category,
        severity: t.findings.severity,
        ...this.findingStateColumns(),
      })
      .from(c)
      .innerJoin(t.reviews, and(eq(t.reviews.runId, c.id), eq(t.reviews.workspaceId, workspaceId)))
      .innerJoin(t.findings, eq(t.findings.reviewId, t.reviews.id))
      .groupBy(c.win, c.agentId, t.findings.category, t.findings.severity);
  }

  async reviewedPrCount(workspaceId: string, range: PerfRange): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(distinct ${t.agentRuns.prId})::int` })
      .from(t.agentRuns)
      .where(and(this.countedRunsWhere(workspaceId, range.from, range.to), isNotNull(t.agentRuns.prId)));
    return row?.n ?? 0;
  }

  /** Both skill reads call this, so the card and the Stats tab share one numerator (D-7, R-18, R-78). */
  async prsWithSkill(workspaceId: string, range: PerfRange, skillId?: string): Promise<Map<string, number>> {
    const rows = await this.db
      .select({ skillId: t.skills.id, n: sql<number>`count(distinct ${t.agentRuns.prId})::int` })
      .from(t.agentRuns)
      .innerJoin(t.agents, eq(t.agents.id, t.agentRuns.agentId))
      .innerJoin(t.agentSkills, eq(t.agentSkills.agentId, t.agents.id))
      .innerJoin(t.skills, eq(t.skills.id, t.agentSkills.skillId))
      .where(
        and(
          this.countedRunsWhere(workspaceId, range.from, range.to),
          isNotNull(t.agentRuns.prId),
          activeSkillOnAgent(),
          eq(t.agents.workspaceId, workspaceId),
          eq(t.skills.workspaceId, workspaceId),
          skillId ? eq(t.skills.id, skillId) : undefined,
        ),
      )
      .groupBy(t.skills.id);
    return new Map(rows.map((r) => [r.skillId, r.n]));
  }
}

/** Runs `read`; a Postgres unknown-zone error becomes a 422 `validation_error`, anything else is rethrown. */
async function mapUnknownTimeZone<T>(tz: string, read: () => PromiseLike<T>): Promise<T> {
  try {
    return await read();
  } catch (err) {
    // A bad request, not a server fault (plan Risks, F-09).
    if (isUnknownTimeZoneError(err)) {
      throw new ValidationError('unknown time zone', { field: 'tz', value: tz });
    }
    throw err;
  }
}

/** Postgres 22023 (invalid_parameter_value) 'time zone "…" not recognized', on the error or its cause. */
function isUnknownTimeZoneError(err: unknown): boolean {
  for (let e: unknown = err, i = 0; e && i < 3; e = (e as { cause?: unknown }).cause, i++) {
    const { code, message } = e as { code?: unknown; message?: unknown };
    if (code === '22023' && typeof message === 'string' && /time zone/i.test(message)) return true;
  }
  return false;
}
