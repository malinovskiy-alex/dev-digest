/**
 * PR-list rollup helpers (`modules/pulls/status.ts`) — the pure derivation that
 * decides each PR's review STATUS and tallies its FINDINGS for the list. The DB
 * `status` column holds GitHub's merge state; the review status
 * (needs_review / reviewed / stale) is derived here from head vs lastReviewedSha
 * + age, so it gets unit coverage independent of the route's queries.
 */
import { describe, it, expect } from 'vitest';
import {
  deriveReviewStatus,
  totalCostByPr,
  rollupSeverities,
  STALE_DAYS,
} from '../src/modules/pulls/status.js';

const DAY = 86_400_000;
const now = Date.UTC(2026, 5, 11);

describe('deriveReviewStatus', () => {
  it('needs_review when never reviewed, or when head moved since the last review', () => {
    expect(
      deriveReviewStatus({ ghStatus: 'open', lastReviewedSha: null, headSha: 'abc', updatedAt: new Date(now), now }),
    ).toBe('needs_review');
    expect(
      deriveReviewStatus({ ghStatus: 'open', lastReviewedSha: 'old', headSha: 'abc', updatedAt: new Date(now), now }),
    ).toBe('needs_review');
  });

  it('reviewed when the current head was reviewed and the PR is recent', () => {
    expect(
      deriveReviewStatus({ ghStatus: 'open', lastReviewedSha: 'abc', headSha: 'abc', updatedAt: new Date(now - DAY), now }),
    ).toBe('reviewed');
  });

  it('stale when the current head was reviewed but the PR is older than STALE_DAYS', () => {
    expect(
      deriveReviewStatus({
        ghStatus: 'open',
        lastReviewedSha: 'abc',
        headSha: 'abc',
        updatedAt: new Date(now - (STALE_DAYS + 1) * DAY),
        now,
      }),
    ).toBe('stale');
  });

  it('keeps merged/closed regardless of review state', () => {
    expect(
      deriveReviewStatus({ ghStatus: 'merged', lastReviewedSha: null, headSha: 'abc', updatedAt: null, now }),
    ).toBe('merged');
    expect(
      deriveReviewStatus({ ghStatus: 'closed', lastReviewedSha: 'abc', headSha: 'abc', updatedAt: new Date(now), now }),
    ).toBe('closed');
  });
});

describe('rollupSeverities', () => {
  it('tallies findings into CRITICAL / WARNING / SUGGESTION buckets (ignores unknown)', () => {
    expect(
      rollupSeverities([
        { severity: 'CRITICAL' },
        { severity: 'CRITICAL' },
        { severity: 'WARNING' },
        { severity: 'SUGGESTION' },
        { severity: 'WEIRD' },
      ]),
    ).toEqual({ CRITICAL: 2, WARNING: 1, SUGGESTION: 1 });
  });

  it('is all-zero for no findings', () => {
    expect(rollupSeverities([])).toEqual({ CRITICAL: 0, WARNING: 0, SUGGESTION: 0 });
  });
});

describe('totalCostByPr', () => {
  it('sums every completed run of a PR, not just the newest', () => {
    const byPr = totalCostByPr([
      { prId: 'pr-1', costUsd: 0.014 },
      { prId: 'pr-1', costUsd: 0.9 },
      { prId: 'pr-2', costUsd: 0.003 },
    ]);
    expect(byPr.get('pr-1')).toBeCloseTo(0.914, 6);
    expect(byPr.get('pr-2')).toBeCloseTo(0.003, 6);
  });

  it('adds the priced runs when only some of them have a known price', () => {
    const byPr = totalCostByPr([
      { prId: 'pr-1', costUsd: null },
      { prId: 'pr-1', costUsd: 0.5 },
    ]);
    expect(byPr.get('pr-1')).toBeCloseTo(0.5, 6);
  });

  it('stays null when no run of the PR has a known price', () => {
    const byPr = totalCostByPr([
      { prId: 'pr-1', costUsd: null },
      { prId: 'pr-1', costUsd: null },
    ]);
    expect(byPr.has('pr-1')).toBe(true);
    expect(byPr.get('pr-1')).toBeNull();
  });

  it('omits a PR with no runs, so the list can render an em dash', () => {
    expect(totalCostByPr([]).has('pr-1')).toBe(false);
    expect(totalCostByPr([{ prId: null, costUsd: 0.1 }]).size).toBe(0);
  });
});
