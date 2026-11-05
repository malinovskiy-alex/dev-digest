import type {
  AgentPerfFigures,
  AgentPerfTableRow,
  AgentPerformanceReport,
  AgentStatsReport,
  AppliedRange,
  PerfAgentCost,
  PerfComparison,
  PerfModelCost,
  PerfRangeQuery,
} from '@devdigest/shared';
import { COST_DELTA_STEP_USD, DELETED_AGENTS_SORT_LABEL, UNKNOWN_MODEL_SORT_LABEL } from './constants.js';
import type { FindingTally, PerfAgentRef, PerfRange, PerfWindow, RunBucket, RunGroup } from './types.js';

/**
 * agent-performance — Ring 1. Every figure on both reads is built here, by the
 * same folds over the same grouped rows, so the per-agent stats and that
 * agent's dashboard row cannot disagree (R-01, D-26). No `Date.now()`, no I/O.
 */

/** The validated querystring → the range the service applies. */
export function toPerfRange(q: PerfRangeQuery): PerfRange {
  return { from: new Date(q.from), to: new Date(q.to), tz: q.tz, bucket: q.bucket };
}

/** The window of equal length that ends at the applied range's start (D-20, R-93). */
export function previousWindow(range: { from: Date; to: Date }): { from: Date; to: Date } {
  const len = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - len), to: new Date(range.from.getTime()) };
}

/** The applied range as echoed on the wire (R-14). */
export function appliedRange(range: PerfRange): AppliedRange {
  const prev = previousWindow(range);
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    tz: range.tz,
    previous: { from: prev.from.toISOString(), to: prev.to.toISOString() },
  };
}

/** accepted / decided, or null when nothing is decided (R-11). */
export function acceptRate(accepted: number, decided: number): number | null {
  return decided === 0 ? null : accepted / decided;
}

/** Whole percent, the same rounding the client's `acceptPercent` uses. */
export function wholePercent(rate: number): number {
  return Math.round(rate * 100);
}

/**
 * A fixed summation order: the SQL returns groups in no defined order, and a
 * float sum depends on its order. Sorting first keeps both reads bit-identical.
 */
function byGroupKey(a: RunGroup, b: RunGroup): number {
  return (
    cmpNullable(a.win, b.win) ||
    cmpNullable(a.agentId, b.agentId) ||
    cmpNullable(a.provider, b.provider) ||
    cmpNullable(a.model, b.model)
  );
}

function cmpNullable(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a < b ? -1 : 1;
}

/**
 * One agent's (or one pool's) figures for one window. Sums first, then divides
 * (R-08, R-09 — never an average of averages). Costs stay null while no counted
 * run has a price (R-07).
 */
export function foldFigures(groups: RunGroup[], tallies: FindingTally[] = []): AgentPerfFigures {
  let runs = 0;
  let pricedRuns = 0;
  let costSum = 0;
  let timedRuns = 0;
  let durationSum = 0;
  let lastRunAt: Date | null = null;
  for (const g of [...groups].sort(byGroupKey)) {
    runs += g.runs;
    pricedRuns += g.pricedRuns;
    if (g.costSum !== null) costSum += g.costSum;
    timedRuns += g.timedRuns;
    if (g.durationSum !== null) durationSum += g.durationSum;
    if (g.lastRunAt && (!lastRunAt || g.lastRunAt.getTime() > lastRunAt.getTime())) lastRunAt = g.lastRunAt;
  }
  let accepted = 0;
  let dismissed = 0;
  let pending = 0;
  for (const t of tallies) {
    accepted += t.accepted;
    dismissed += t.dismissed;
    pending += t.pending;
  }
  const decided = accepted + dismissed;
  const total = pricedRuns === 0 ? null : costSum;
  return {
    runs,
    priced_runs: pricedRuns,
    unpriced_runs: runs - pricedRuns,
    total_cost_usd: total,
    avg_cost_usd: total === null ? null : total / pricedRuns,
    avg_duration_ms: timedRuns === 0 ? null : durationSum / timedRuns,
    accepted,
    dismissed,
    pending,
    decided,
    accept_rate: acceptRate(accepted, decided),
    last_run_at: lastRunAt ? lastRunAt.toISOString() : null,
  };
}

function modelSortLabel(s: PerfModelCost): string {
  return s.model ?? UNKNOWN_MODEL_SORT_LABEL;
}

/**
 * Cost per provider+model over the priced runs (R-22, R-23). Groups without a
 * stored model fold into one segment whatever their provider. Cost desc, then
 * label asc.
 */
export function foldModelCosts(groups: RunGroup[]): PerfModelCost[] {
  const byKey = new Map<string, PerfModelCost>();
  for (const g of [...groups].sort(byGroupKey)) {
    if (g.pricedRuns === 0 || g.costSum === null) continue;
    const provider = g.model === null ? null : g.provider;
    const key = g.model === null ? '\u0000unknown' : `${provider ?? ''}\u0000${g.model}`;
    const seg = byKey.get(key) ?? { provider, model: g.model, runs: 0, cost_usd: 0 };
    seg.runs += g.pricedRuns;
    seg.cost_usd += g.costSum;
    byKey.set(key, seg);
  }
  return [...byKey.values()].sort(
    (a, b) =>
      b.cost_usd - a.cost_usd ||
      cmpNullable(modelSortLabel(a), modelSortLabel(b)) ||
      cmpNullable(a.provider, b.provider),
  );
}

/** Round a cost difference to `COST_DELTA_STEP_USD` (equal periods → exactly 0, F-11); `-0` normalises to `0`. */
export function roundCostDelta(usd: number): number {
  const r = Math.round(usd / COST_DELTA_STEP_USD) * COST_DELTA_STEP_USD;
  const fixed = Number(r.toFixed(4));
  return fixed === 0 ? 0 : fixed;
}

type Comparable = Pick<AgentPerfFigures, 'runs' | 'total_cost_usd' | 'decided' | 'accept_rate'>;

/** Current vs previous window — unknown is null, never 0 (D-21, D-22, R-95…R-97). */
export function compare(current: Comparable, previous: Comparable): PerfComparison {
  const cost_delta_usd =
    current.total_cost_usd !== null && previous.total_cost_usd !== null
      ? roundCostDelta(current.total_cost_usd - previous.total_cost_usd)
      : null;
  let accept_trend: PerfComparison['accept_trend'] = null;
  if (current.accept_rate !== null && previous.accept_rate !== null) {
    const c = wholePercent(current.accept_rate);
    const p = wholePercent(previous.accept_rate);
    accept_trend = c > p ? 'up' : c < p ? 'down' : 'flat';
  }
  return {
    previous_runs: previous.runs,
    previous_total_cost_usd: previous.total_cost_usd,
    previous_decided: previous.decided,
    previous_accept_rate: previous.accept_rate,
    cost_delta_usd,
    accept_trend,
  };
}

/**
 * The existing agent with the most counted runs in the current window; ties →
 * later last run, then name asc, then id (R-19, Q-02). Never the deleted row,
 * null when no agent ran (R-20).
 */
export function pickMostActive(rows: AgentPerfTableRow[]): string | null {
  const candidates = rows.filter((r) => r.kind === 'agent' && r.agent_id !== null && r.figures.runs > 0);
  candidates.sort(
    (a, b) =>
      b.figures.runs - a.figures.runs ||
      cmpNullable(b.figures.last_run_at, a.figures.last_run_at) ||
      cmpNullable(a.agent_name, b.agent_name) ||
      cmpNullable(a.agent_id, b.agent_id),
  );
  return candidates[0]?.agent_id ?? null;
}

function splitByWindow<T extends { win: PerfWindow }>(items: T[]): Record<PerfWindow, T[]> {
  const out: Record<PerfWindow, T[]> = { current: [], previous: [] };
  for (const it of items) out[it.win].push(it);
  return out;
}

/** The row-key of a group: an existing agent's id, or null for "deleted" (also an id no longer in the list). */
function rowKey(agentId: string | null, existing: Set<string>): string | null {
  return agentId !== null && existing.has(agentId) ? agentId : null;
}

function bucketByRow<T extends { agentId: string | null }>(items: T[], existing: Set<string>): Map<string | null, T[]> {
  const out = new Map<string | null, T[]>();
  for (const it of items) {
    const k = rowKey(it.agentId, existing);
    const list = out.get(k);
    if (list) list.push(it);
    else out.set(k, [it]);
  }
  return out;
}

/** GET /agents/:id/stats — one agent, both windows, same folds as its dashboard row. */
export function buildStats(
  range: PerfRange,
  agent: PerfAgentRef,
  groups: RunGroup[],
  tallies: FindingTally[],
): AgentStatsReport {
  const g = splitByWindow(groups.filter((x) => x.agentId === agent.id));
  const t = splitByWindow(tallies.filter((x) => x.agentId === agent.id));
  const figures = foldFigures(g.current, t.current);
  const previous = foldFigures(g.previous, t.previous);
  return {
    range: appliedRange(range),
    agent: { id: agent.id, name: agent.name },
    figures,
    comparison: compare(figures, previous),
    cost_by_model: foldModelCosts(g.current),
  };
}

/** GET /agents/performance — every agent, the folded deleted row, totals and breakdowns. */
export function buildDashboard(
  range: PerfRange,
  agents: PerfAgentRef[],
  groups: RunGroup[],
  tallies: FindingTally[],
  buckets: RunBucket[],
): AgentPerformanceReport {
  const existing = new Set(agents.map((a) => a.id));
  const g = splitByWindow(groups);
  const t = splitByWindow(tallies);
  const gCur = bucketByRow(g.current, existing);
  const gPrev = bucketByRow(g.previous, existing);
  const tCur = bucketByRow(t.current, existing);
  const tPrev = bucketByRow(t.previous, existing);

  const rowFor = (key: string | null): Omit<AgentPerfTableRow, 'kind' | 'agent_id' | 'agent_name' | 'enabled'> => {
    const curGroups = gCur.get(key) ?? [];
    const figures = foldFigures(curGroups, tCur.get(key) ?? []);
    const previous = foldFigures(gPrev.get(key) ?? [], tPrev.get(key) ?? []);
    return { figures, comparison: compare(figures, previous), cost_by_model: foldModelCosts(curGroups) };
  };

  const rows: AgentPerfTableRow[] = agents.map((a) => ({
    kind: 'agent',
    agent_id: a.id,
    agent_name: a.name,
    enabled: a.enabled,
    ...rowFor(a.id),
  }));
  const deleted = rowFor(null);
  if (deleted.figures.runs > 0) {
    rows.push({ kind: 'deleted', agent_id: null, agent_name: null, enabled: null, ...deleted });
  }

  // Totals are the sums of the rows (R-15, R-17, R-18).
  let runs = 0;
  let pricedRuns = 0;
  let unpriced = 0;
  let cost = 0;
  let accepted = 0;
  let decided = 0;
  for (const r of rows) {
    runs += r.figures.runs;
    pricedRuns += r.figures.priced_runs;
    unpriced += r.figures.unpriced_runs;
    if (r.figures.total_cost_usd !== null) cost += r.figures.total_cost_usd;
    accepted += r.figures.accepted;
    decided += r.figures.decided;
  }
  const totalCost = pricedRuns === 0 ? null : cost;
  const accept_rate = acceptRate(accepted, decided);
  // The pooled previous window: every previous run, deleted agents included (D-27).
  const pooledPrevious = foldFigures(g.previous, t.previous);

  const cost_by_agent: PerfAgentCost[] = rows
    .filter((r) => r.figures.priced_runs > 0 && r.figures.total_cost_usd !== null)
    .map((r) => ({
      kind: r.kind,
      agent_id: r.agent_id,
      agent_name: r.agent_name,
      runs: r.figures.priced_runs,
      cost_usd: r.figures.total_cost_usd as number,
    }))
    .sort(
      (a, b) =>
        b.cost_usd - a.cost_usd ||
        cmpNullable(a.agent_name ?? DELETED_AGENTS_SORT_LABEL, b.agent_name ?? DELETED_AGENTS_SORT_LABEL) ||
        cmpNullable(a.agent_id, b.agent_id),
    );

  return {
    range: appliedRange(range),
    totals: {
      runs,
      unpriced_runs: unpriced,
      total_cost_usd: totalCost,
      accepted,
      decided,
      accept_rate,
      comparison: compare({ runs, total_cost_usd: totalCost, decided, accept_rate }, pooledPrevious),
      bucket_unit: range.bucket,
      run_buckets: [...buckets].sort((a, b) => cmpNullable(a.key, b.key)),
    },
    most_active_agent_id: pickMostActive(rows),
    agents: rows,
    cost_by_agent,
    cost_by_model: foldModelCosts(g.current),
  };
}
