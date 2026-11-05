/**
 * agent-performance helpers (L08) — the pure folds both reads share.
 * Cases follow specs/L08-agent-performance.decisions.md §C, step 21.
 */
import { describe, it, expect } from 'vitest';
import {
  acceptRate,
  buildDashboard,
  buildStats,
  compare,
  foldFigures,
  foldModelCosts,
  pickMostActive,
  previousWindow,
  roundCostDelta,
} from '../src/modules/agent-performance/helpers.js';
import type {
  FindingTally,
  PerfAgentRef,
  PerfRange,
  RunBucket,
  RunGroup,
} from '../src/modules/agent-performance/types.js';
import type { AgentPerfFigures, AgentPerfTableRow } from '@devdigest/shared';

const RANGE: PerfRange = {
  from: new Date('2026-10-01T00:00:00Z'),
  to: new Date('2026-10-31T00:00:00Z'),
  tz: 'UTC',
  bucket: 'day',
};

function group(p: Partial<RunGroup> & { agentId: string | null }): RunGroup {
  return {
    win: 'current',
    provider: 'openai',
    model: 'gpt-4o',
    runs: 1,
    pricedRuns: 1,
    costSum: 0.1,
    timedRuns: 1,
    durationSum: 1000,
    lastRunAt: new Date('2026-10-10T00:00:00Z'),
    ...p,
  };
}

function tally(p: Partial<FindingTally> & { agentId: string | null }): FindingTally {
  return { win: 'current', accepted: 0, dismissed: 0, pending: 0, ...p };
}

const A: PerfAgentRef = { id: 'a', name: 'Alpha', enabled: true };
const B: PerfAgentRef = { id: 'b', name: 'Beta', enabled: false };
const C: PerfAgentRef = { id: 'c', name: 'Gamma', enabled: true };

function figures(p: Partial<AgentPerfFigures>): AgentPerfFigures {
  return {
    runs: 0,
    priced_runs: 0,
    unpriced_runs: 0,
    total_cost_usd: null,
    avg_cost_usd: null,
    avg_duration_ms: null,
    accepted: 0,
    dismissed: 0,
    pending: 0,
    decided: 0,
    accept_rate: null,
    last_run_at: null,
    ...p,
  };
}

describe('acceptRate', () => {
  it('divides accepted by decided, null when nothing is decided (R-11)', () => {
    expect(acceptRate(3, 4)).toBe(0.75);
    expect(acceptRate(0, 0)).toBeNull();
    expect(acceptRate(0, 5)).toBe(0);
  });
});

describe('foldFigures', () => {
  it('sums first, then divides — never an average of averages (R-05…R-09)', () => {
    const f = foldFigures(
      [
        group({ agentId: 'a', runs: 3, pricedRuns: 3, costSum: 0.3, timedRuns: 3, durationSum: 3000 }),
        group({ agentId: 'a', model: 'gpt-4o-mini', runs: 2, pricedRuns: 1, costSum: 0.5, timedRuns: 1, durationSum: 9000 }),
        group({ agentId: 'a', model: 'x', runs: 1, pricedRuns: 0, costSum: null, timedRuns: 0, durationSum: null }),
      ],
      [tally({ agentId: 'a', accepted: 3, dismissed: 1, pending: 2 })],
    );
    expect(f.runs).toBe(6);
    expect(f.priced_runs).toBe(4);
    expect(f.unpriced_runs).toBe(2);
    expect(f.total_cost_usd).toBeCloseTo(0.8, 12);
    expect(f.avg_cost_usd).toBeCloseTo(0.2, 12);
    expect(f.avg_duration_ms).toBe(3000); // 12000 / 4, not mean(1000, 9000)
    expect(f.accepted).toBe(3);
    expect(f.dismissed).toBe(1);
    expect(f.pending).toBe(2);
    expect(f.decided).toBe(4);
    expect(f.accept_rate).toBe(0.75);
  });

  it('reports costs as null, never 0, when no run is priced (R-07)', () => {
    const f = foldFigures([group({ agentId: 'a', runs: 2, pricedRuns: 0, costSum: null, timedRuns: 0, durationSum: null })]);
    expect(f.total_cost_usd).toBeNull();
    expect(f.avg_cost_usd).toBeNull();
    expect(f.avg_duration_ms).toBeNull();
    expect(f.unpriced_runs).toBe(2);
  });

  it('takes the latest last run and returns all zero/null for no groups', () => {
    const f = foldFigures([
      group({ agentId: 'a', lastRunAt: new Date('2026-10-02T00:00:00Z') }),
      group({ agentId: 'a', model: 'm2', lastRunAt: new Date('2026-10-20T00:00:00Z') }),
    ]);
    expect(f.last_run_at).toBe('2026-10-20T00:00:00.000Z');
    expect(foldFigures([])).toEqual(figures({}));
  });
});

describe('foldModelCosts', () => {
  it('splits providers, merges null models, skips unpriced, sorts cost desc then label (R-22, R-23, R-67)', () => {
    const segs = foldModelCosts([
      group({ agentId: 'a', provider: 'openai', model: 'shared', costSum: 0.2 }),
      group({ agentId: 'a', provider: 'openrouter', model: 'shared', costSum: 0.2 }),
      group({ agentId: 'a', provider: 'openai', model: null, costSum: 0.3 }),
      group({ agentId: 'b', provider: 'anthropic', model: null, costSum: 0.4 }),
      group({ agentId: 'a', provider: 'openai', model: 'free', pricedRuns: 0, costSum: null }),
    ]);
    expect(segs).toHaveLength(3);
    expect(segs[0]).toMatchObject({ provider: null, model: null, runs: 2 });
    expect(segs[0]!.cost_usd).toBeCloseTo(0.7, 12);
    expect(segs.slice(1).map((s) => s.provider)).toEqual(['openai', 'openrouter']);
    expect(segs.some((s) => s.model === 'free')).toBe(false);
  });
});

describe('compare', () => {
  it('gives a cost delta only when both totals are known (R-95)', () => {
    expect(compare(figures({ total_cost_usd: 1.5 }), figures({ total_cost_usd: 1 })).cost_delta_usd).toBeCloseTo(0.5, 12);
    expect(compare(figures({ total_cost_usd: 1.5 }), figures({ total_cost_usd: null })).cost_delta_usd).toBeNull();
    expect(compare(figures({ total_cost_usd: null }), figures({ total_cost_usd: 1 })).cost_delta_usd).toBeNull();
  });

  it('rounds the delta to 1e-4 USD so equal periods give exactly 0 (F-11)', () => {
    expect(0.1 + 0.2 - 0.3).not.toBe(0); // the float trap
    const c = compare(figures({ total_cost_usd: 0.1 + 0.2 }), figures({ total_cost_usd: 0.3 }));
    expect(c.cost_delta_usd).toBe(0);
    expect(Object.is(roundCostDelta(-0.00004), 0)).toBe(true); // no -0
    expect(roundCostDelta(0.00012345)).toBe(0.0001);
    expect(roundCostDelta(-1.23456)).toBe(-1.2346);
  });

  it('compares whole percents; null when either rate is unknown (R-96, R-97)', () => {
    const t = (cur: number | null, prev: number | null) =>
      compare(figures({ accept_rate: cur, decided: 3 }), figures({ accept_rate: prev, decided: 3 })).accept_trend;
    expect(t(0.674, 0.666)).toBe('flat');
    expect(t(0.8, 0.5)).toBe('up');
    expect(t(0.4, 0.5)).toBe('down');
    expect(t(null, 0.5)).toBeNull();
    expect(t(0.5, null)).toBeNull();
    // 3 decided — a small sample still gets a trend (R-96).
    expect(t(2 / 3, 1 / 3)).toBe('up');
  });

  it('echoes the previous figures (R-106)', () => {
    const c = compare(figures({}), figures({ runs: 4, total_cost_usd: 0.9, decided: 2, accept_rate: 0.5 }));
    expect(c).toMatchObject({
      previous_runs: 4,
      previous_total_cost_usd: 0.9,
      previous_decided: 2,
      previous_accept_rate: 0.5,
    });
  });
});

describe('pickMostActive', () => {
  const row = (id: string | null, name: string | null, runs: number, last: string | null): AgentPerfTableRow => ({
    kind: id === null ? 'deleted' : 'agent',
    agent_id: id,
    agent_name: name,
    enabled: id === null ? null : true,
    figures: figures({ runs, last_run_at: last }),
    comparison: compare(figures({}), figures({})),
    cost_by_model: [],
  });

  it('most runs, then later last run, then name asc (R-19)', () => {
    expect(pickMostActive([row('a', 'A', 2, '2026-10-01T00:00:00.000Z'), row('b', 'B', 3, '2026-09-01T00:00:00.000Z')])).toBe('b');
    expect(pickMostActive([row('a', 'A', 3, '2026-10-01T00:00:00.000Z'), row('b', 'B', 3, '2026-10-02T00:00:00.000Z')])).toBe('b');
    expect(pickMostActive([row('z', 'Zed', 3, '2026-10-01T00:00:00.000Z'), row('y', 'Amy', 3, '2026-10-01T00:00:00.000Z')])).toBe('y');
  });

  it('never the deleted row; null when nothing ran (R-20, R-21)', () => {
    expect(pickMostActive([row(null, null, 9, '2026-10-01T00:00:00.000Z'), row('a', 'A', 1, '2026-10-01T00:00:00.000Z')])).toBe('a');
    expect(pickMostActive([row('a', 'A', 0, null), row(null, null, 5, '2026-10-01T00:00:00.000Z')])).toBeNull();
  });
});

describe('previousWindow', () => {
  it('has equal length and ends at from (R-93)', () => {
    const p = previousWindow(RANGE);
    expect(p.to.getTime()).toBe(RANGE.from.getTime());
    expect(RANGE.from.getTime() - p.from.getTime()).toBe(RANGE.to.getTime() - RANGE.from.getTime());
  });
});

describe('buildDashboard / buildStats', () => {
  // Many small costs so float order matters.
  const groups: RunGroup[] = [];
  for (let i = 0; i < 30; i++) {
    groups.push(group({ agentId: 'a', model: `m${i % 3}`, costSum: 0.1 * ((i % 3) + 1), runs: 1 }));
    groups.push(group({ agentId: 'b', provider: 'anthropic', model: `n${i % 4}`, costSum: 0.3 }));
  }
  groups.push(group({ agentId: null, model: null, costSum: 0.2, runs: 2, pricedRuns: 1 }));
  groups.push(group({ agentId: 'gone', model: 'm0', costSum: 0.1, runs: 4 }));
  // previous window
  groups.push(group({ win: 'previous', agentId: 'a', runs: 50, costSum: 5 }));
  groups.push(group({ win: 'previous', agentId: 'c', runs: 50, costSum: 5 }));
  const tallies: FindingTally[] = [
    tally({ agentId: 'a', accepted: 4, dismissed: 1, pending: 3 }),
    tally({ agentId: 'b', accepted: 1, dismissed: 3 }),
    tally({ agentId: null, accepted: 2, dismissed: 0, pending: 1 }),
    tally({ win: 'previous', agentId: 'a', accepted: 1, dismissed: 1 }),
  ];
  const buckets: RunBucket[] = [
    { key: '2026-10-12', runs: 30 },
    { key: '2026-10-02', runs: 36 },
  ];
  const report = buildDashboard(RANGE, [A, B, C], groups, tallies, buckets);

  it('has a row for every agent plus one deleted row (R-21, R-24)', () => {
    expect(report.agents.map((r) => r.agent_id)).toEqual(['a', 'b', 'c', null]);
    const deleted = report.agents.find((r) => r.kind === 'deleted')!;
    // agent_id null and an id no longer in the list fold together.
    expect(deleted.figures.runs).toBe(6);
    const c = report.agents.find((r) => r.agent_id === 'c')!;
    expect(c.figures).toEqual(figures({})); // previous-window runs never leak in
    expect(c.comparison.previous_runs).toBe(50);
  });

  it('totals equal the sums of rows and of both breakdowns (R-15…R-18)', () => {
    const sum = (f: (r: AgentPerfTableRow) => number) => report.agents.reduce((s, r) => s + f(r), 0);
    expect(report.totals.runs).toBe(sum((r) => r.figures.runs));
    expect(report.totals.runs).toBe(66);
    expect(report.totals.unpriced_runs).toBe(sum((r) => r.figures.unpriced_runs));
    expect(report.totals.accepted).toBe(7);
    expect(report.totals.decided).toBe(11);
    expect(report.totals.accept_rate).toBeCloseTo(7 / 11, 12);
    const total = report.totals.total_cost_usd!;
    expect(Math.abs(total - report.cost_by_agent.reduce((s, x) => s + x.cost_usd, 0))).toBeLessThan(1e-9);
    expect(Math.abs(total - report.cost_by_model.reduce((s, x) => s + x.cost_usd, 0))).toBeLessThan(1e-9);
    expect(report.cost_by_agent.map((x) => x.kind)).toContain('deleted');
  });

  it('never picks the deleted row as most active, nor a previous-window agent (R-19, R-21)', () => {
    expect(report.most_active_agent_id).toBe('a');
  });

  it('passes buckets through key asc with the requested unit (R-90, R-91)', () => {
    expect(report.totals.bucket_unit).toBe('day');
    expect(report.totals.run_buckets.map((b) => b.key)).toEqual(['2026-10-02', '2026-10-12']);
    expect(report.totals.run_buckets.reduce((s, b) => s + b.runs, 0)).toBe(report.totals.runs);
    expect(buildDashboard({ ...RANGE, bucket: 'hour' }, [A], [], [], []).totals.bucket_unit).toBe('hour');
  });

  it('echoes the range and the previous window (R-14, R-93)', () => {
    expect(report.range).toEqual({
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-31T00:00:00.000Z',
      tz: 'UTC',
      previous: { from: '2026-09-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' },
    });
  });

  it('stats equal the dashboard row for the same inputs, whatever the input order (R-01, D-26)', () => {
    for (const agent of [A, B]) {
      const own = groups.filter((g) => g.agentId === agent.id).reverse();
      const stats = buildStats(RANGE, agent, own, tallies);
      const row = report.agents.find((r) => r.agent_id === agent.id)!;
      expect(stats.figures).toEqual(row.figures);
      expect(stats.comparison).toEqual(row.comparison);
      expect(stats.cost_by_model).toEqual(row.cost_by_model);
    }
  });

  it('pools the previous window for totals.comparison (D-27)', () => {
    expect(report.totals.comparison.previous_runs).toBe(100);
    expect(report.totals.comparison.previous_total_cost_usd).toBe(10);
    expect(report.totals.comparison.previous_accept_rate).toBe(0.5);
    expect(report.totals.comparison.cost_delta_usd).toBeCloseTo(report.totals.total_cost_usd! - 10, 9);
  });

  it('omits the deleted row when its current window is empty', () => {
    const r = buildDashboard(RANGE, [A], [group({ win: 'previous', agentId: null })], [], []);
    expect(r.agents.map((x) => x.kind)).toEqual(['agent']);
    expect(r.most_active_agent_id).toBeNull();
    expect(r.totals.total_cost_usd).toBeNull();
    expect(r.totals.accept_rate).toBeNull();
  });
});
