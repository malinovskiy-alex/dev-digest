/**
 * L08 follow-up — Skill Stats: the pure folds behind GET /skills/:id/stats,
 * GET /skills/pull-frequency and the `findings` field of GET /agents/:id/stats.
 * Cases U1–U7 of specs/L08-skill-stats.decisions.md §C.
 */
import { describe, it, expect } from 'vitest';
import {
  appliedRange,
  buildSkillStats,
  buildSkillsPullFrequency,
  buildStats,
  foldBreakdown,
  pullFrequency,
  skillFigures,
} from '../src/modules/agent-performance/helpers.js';
import type { BreakdownRow, PerfAgentRef, PerfRange, PerfSkillRef } from '../src/modules/agent-performance/types.js';

const RANGE: PerfRange = {
  from: new Date('2030-01-11T00:00:00Z'),
  to: new Date('2030-01-21T00:00:00Z'),
  tz: 'Europe/Kyiv',
  bucket: 'day',
};

function row(p: Partial<BreakdownRow>): BreakdownRow {
  return { win: 'current', agentId: 'a', category: 'bug', severity: 'WARNING', accepted: 0, dismissed: 0, pending: 0, ...p };
}

const SKILL: PerfSkillRef = { id: 's1', name: 'Skill', enabled: true };
const ALPHA: PerfAgentRef = { id: 'a', name: 'Alpha', enabled: true };
const DELTA: PerfAgentRef = { id: 'd', name: 'Delta', enabled: false };

describe('foldBreakdown (U1)', () => {
  it('counts every category and severity exactly; anything else is other; all sums agree', () => {
    const rows = [
      row({ category: 'security', severity: 'CRITICAL', accepted: 1 }),
      row({ category: 'bug', severity: 'WARNING', dismissed: 2 }),
      row({ category: 'perf', severity: 'SUGGESTION', pending: 3 }),
      row({ category: 'style', severity: 'CRITICAL', accepted: 1, pending: 1 }),
      row({ category: 'test', severity: 'WARNING', dismissed: 1 }),
      // not an exact match → other
      row({ category: 'Security', severity: 'WARNING', accepted: 1 }),
      row({ category: 'misc', severity: 'SUGGESTION', pending: 1 }),
      row({ category: 'bug', severity: 'warning', accepted: 2 }),
    ];
    const f = foldBreakdown(rows);
    expect(f.by_category).toEqual({ security: 1, bug: 4, perf: 3, style: 2, test: 1, other: 2 });
    expect(f.by_severity).toEqual({ CRITICAL: 3, WARNING: 4, SUGGESTION: 4, other: 2 });
    const states = rows.reduce((s, r) => s + r.accepted + r.dismissed + r.pending, 0);
    expect(f.total).toBe(13);
    expect(f.total).toBe(states);
    expect(Object.values(f.by_category).reduce((s, n) => s + n, 0)).toBe(f.total);
    expect(Object.values(f.by_severity).reduce((s, n) => s + n, 0)).toBe(f.total);
  });

  it('no rows → all zeros', () => {
    expect(foldBreakdown([])).toEqual({
      total: 0,
      by_category: { security: 0, bug: 0, perf: 0, style: 0, test: 0, other: 0 },
      by_severity: { CRITICAL: 0, WARNING: 0, SUGGESTION: 0, other: 0 },
    });
  });
});

describe('pullFrequency (U2)', () => {
  it('rate is null at 0/0, otherwise the plain unrounded ratio', () => {
    expect(pullFrequency(0, 0)).toEqual({ prs_with_skill: 0, prs_reviewed: 0, rate: null });
    expect(pullFrequency(1, 3)).toEqual({ prs_with_skill: 1, prs_reviewed: 3, rate: 1 / 3 });
    expect(pullFrequency(2, 2).rate).toBe(1);
    expect(pullFrequency(0, 4).rate).toBe(0);
  });

  it('clamps a numerator above the denominator (read race) to rate 1 with consistent counts (F-22)', () => {
    expect(pullFrequency(5, 3)).toEqual({ prs_with_skill: 3, prs_reviewed: 3, rate: 1 });
    expect(pullFrequency(2, 0)).toEqual({ prs_with_skill: 0, prs_reviewed: 0, rate: null });
  });

  it('both builders inherit the clamp, so stats and card report the same figure (R-18)', () => {
    const expected = { prs_with_skill: 2, prs_reviewed: 2, rate: 1 };
    const list = buildSkillsPullFrequency(RANGE, ['s1'], 2, new Map([['s1', 4]]));
    expect(list.skills[0]!.pull_frequency).toEqual(expected);
    expect(buildSkillStats(RANGE, SKILL, [], [], [], 2, 4).pull_frequency).toEqual(expected);
  });
});

describe('skillFigures (U3)', () => {
  it('nothing decided → accept_rate null', () => {
    expect(skillFigures([row({ pending: 2 })])).toEqual({
      accepted: 0,
      dismissed: 0,
      pending: 2,
      decided: 0,
      accept_rate: null,
    });
  });

  it('3 accepted / 1 dismissed / 2 pending across rows → 0.75 of 4 decided', () => {
    const f = skillFigures([
      row({ accepted: 2, pending: 1 }),
      row({ agentId: 'd', category: 'perf', accepted: 1, dismissed: 1, pending: 1 }),
    ]);
    expect(f).toEqual({ accepted: 3, dismissed: 1, pending: 2, decided: 4, accept_rate: 0.75 });
  });
});

describe('buildSkillStats (U4, U7)', () => {
  it('used_by, ran_in_period, zero-run agents kept, order as given', () => {
    const r = buildSkillStats(
      RANGE,
      SKILL,
      [ALPHA, DELTA],
      [{ agentId: 'a', runs: 2 }],
      [row({ agentId: 'a', accepted: 1, dismissed: 1 })],
      3,
      1,
    );
    expect(r.used_by).toBe(2);
    expect(r.ran_in_period).toBe(1);
    expect(r.agents).toEqual([
      { id: 'a', name: 'Alpha', enabled: true, runs: 2 },
      { id: 'd', name: 'Delta', enabled: false, runs: 0 },
    ]);
    expect(r.skill).toEqual(SKILL);
    expect(r.pull_frequency).toEqual({ prs_with_skill: 1, prs_reviewed: 3, rate: 1 / 3 });
    expect(r.figures).toEqual({ accepted: 1, dismissed: 1, pending: 0, decided: 2, accept_rate: 0.5 });
    expect(r.findings.total).toBe(2);
    expect(r.range).toEqual(appliedRange(RANGE));
  });

  it('folds the rows as given — the repository already limits them to the using agents (F-14)', () => {
    const r = buildSkillStats(
      RANGE,
      SKILL,
      [ALPHA, DELTA],
      [{ agentId: 'a', runs: 1 }],
      [row({ agentId: 'a', pending: 1 }), row({ agentId: 'd', category: 'perf', accepted: 2 })],
      0,
      0,
    );
    expect(r.findings.total).toBe(3);
    expect(r.figures).toEqual({ accepted: 2, dismissed: 0, pending: 1, decided: 2, accept_rate: 1 });
    expect(r.ran_in_period).toBe(1);
    expect(r.agents.map((a) => a.runs)).toEqual([1, 0]);
  });

  it('no using agent → empty list and zero figures', () => {
    const r = buildSkillStats(RANGE, SKILL, [], [], [], 0, 0);
    expect(r.used_by).toBe(0);
    expect(r.agents).toEqual([]);
    expect(r.figures.accept_rate).toBeNull();
    expect(r.pull_frequency.rate).toBeNull();
  });
});

describe('buildSkillsPullFrequency (U5, U7)', () => {
  it('one entry per id in order, missing numerator → 0, shared denominator', () => {
    const r = buildSkillsPullFrequency(RANGE, ['s1', 's2', 's3'], 4, new Map([['s2', 3]]));
    expect(r.skills).toEqual([
      { skill_id: 's1', pull_frequency: { prs_with_skill: 0, prs_reviewed: 4, rate: 0 } },
      { skill_id: 's2', pull_frequency: { prs_with_skill: 3, prs_reviewed: 4, rate: 0.75 } },
      { skill_id: 's3', pull_frequency: { prs_with_skill: 0, prs_reviewed: 4, rate: 0 } },
    ]);
    expect(r.range).toEqual(appliedRange(RANGE));
  });

  it('no reviewed PR → every rate null', () => {
    const r = buildSkillsPullFrequency(RANGE, ['s1'], 0, new Map());
    expect(r.skills[0]!.pull_frequency).toEqual({ prs_with_skill: 0, prs_reviewed: 0, rate: null });
  });
});

describe('buildStats findings (U6)', () => {
  it("takes the agent's own current-window breakdown rows only", () => {
    const s = buildStats(RANGE, ALPHA, [], [], [
      row({ agentId: 'a', category: 'security', severity: 'CRITICAL', accepted: 1 }),
      row({ agentId: 'a', category: 'misc', severity: 'SUGGESTION', pending: 2 }),
      row({ agentId: 'd', category: 'bug', accepted: 9 }),
      row({ win: 'previous', agentId: 'a', category: 'bug', accepted: 4 }),
    ]);
    expect(s.findings).toEqual({
      total: 3,
      by_category: { security: 1, bug: 0, perf: 0, style: 0, test: 0, other: 2 },
      by_severity: { CRITICAL: 1, WARNING: 0, SUGGESTION: 2, other: 0 },
    });
  });

  it('without a 5th argument → all zeros', () => {
    expect(buildStats(RANGE, ALPHA, [], []).findings).toEqual(foldBreakdown([]));
  });

  it('F-11: breakdown rows double as the tallies — both windows, same figures as summed tallies', () => {
    const rows = [
      row({ category: 'security', accepted: 1, dismissed: 1 }),
      row({ category: 'bug', pending: 2 }),
      row({ win: 'previous', accepted: 1, dismissed: 1 }),
    ];
    const tallies = [
      { win: 'current' as const, agentId: 'a', accepted: 1, dismissed: 1, pending: 2 },
      { win: 'previous' as const, agentId: 'a', accepted: 1, dismissed: 1, pending: 0 },
    ];
    const fromRows = buildStats(RANGE, ALPHA, [], rows, rows);
    const fromTallies = buildStats(RANGE, ALPHA, [], tallies, rows);
    expect(fromRows).toEqual(fromTallies);
    expect(fromRows.figures.decided).toBe(2);
    expect(fromRows.comparison.previous_decided).toBe(2);
    expect(fromRows.findings.total).toBe(4);
  });
});
