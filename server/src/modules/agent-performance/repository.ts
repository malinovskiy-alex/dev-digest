import { and, asc, eq, gte, lt, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { ValidationError } from '../../platform/errors.js';
import * as t from '../../db/schema.js';
import { BUCKET_SQL, COUNTED_RUN_STATUS } from './constants.js';
import { previousWindow } from './helpers.js';
import type {
  FindingTally,
  PerfAgentRef,
  PerfRange,
  PerformanceReadSource,
  PerfWindow,
  RunBucket,
  RunGroup,
} from './types.js';

/**
 * agent-performance data access (L08). **Read-only** over four tables this
 * module does not own — `agents`, `agent_runs`, `reviews`, `findings` (D-5).
 * Nothing here inserts, updates or deletes. Every statement is scoped to the
 * caller's workspace (R-30), and joins re-check the workspace on `reviews`.
 *
 * A "counted run" is: this workspace, status 'done', `from <= ran_at < to`,
 * any source (R-02…R-04, Q-01). Group reads span both windows in one statement
 * and tag each run with `win` (D-20), so the previous window is counted by
 * exactly the same predicate as the current one.
 */
export class PerformanceRepository implements PerformanceReadSource {
  constructor(private db: Db) {}

  private countedRunsWhere(workspaceId: string, from: Date, to: Date, agentId?: string): SQL | undefined {
    return and(
      eq(t.agentRuns.workspaceId, workspaceId),
      eq(t.agentRuns.status, COUNTED_RUN_STATUS),
      gte(t.agentRuns.ranAt, from),
      lt(t.agentRuns.ranAt, to),
      agentId ? eq(t.agentRuns.agentId, agentId) : undefined,
    );
  }

  /** Counted runs of both windows, with their window tag, as a CTE. */
  private countedRuns(workspaceId: string, range: PerfRange, agentId?: string) {
    const prev = previousWindow(range);
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
        .where(this.countedRunsWhere(workspaceId, prev.from, range.to, agentId)),
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

  async findingTallies(workspaceId: string, range: PerfRange, agentId?: string): Promise<FindingTally[]> {
    const c = this.countedRuns(workspaceId, range, agentId);
    // Every finding kind counts (Q-04); state is read as it is now (R-10).
    return this.db
      .with(c)
      .select({
        win: c.win,
        agentId: c.agentId,
        accepted: sql<number>`count(*) filter (where ${t.findings.acceptedAt} is not null)::int`,
        dismissed: sql<number>`count(*) filter (where ${t.findings.acceptedAt} is null and ${t.findings.dismissedAt} is not null)::int`,
        pending: sql<number>`count(*) filter (where ${t.findings.acceptedAt} is null and ${t.findings.dismissedAt} is null)::int`,
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
