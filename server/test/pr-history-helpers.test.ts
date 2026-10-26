/**
 * pr-history — the overlap mapping. Pure, no DB.
 */
import { describe, it, expect } from 'vitest';
import { PrHistory } from '@devdigest/shared';
import { toPrHistory } from '../src/modules/pr-history/helpers.js';
import type { MergedPull } from '../src/modules/pr-history/types.js';

function pull(number: number, updatedAt: string | null): MergedPull {
  return {
    id: `id-${number}`,
    number,
    title: `PR ${number}`,
    author: `dev${number}`,
    updatedAt: updatedAt ? new Date(updatedAt) : null,
  };
}

const META = { candidates: 4, unchecked: 1, githubUnavailable: true };

describe('toPrHistory', () => {
  it('keeps overlapping PRs, newest first, with sorted overlap and meta copied', () => {
    const out = toPrHistory(
      ['b.ts', 'a.ts', 'c.ts'],
      [
        { pull: pull(5, '2026-01-01T00:00:00Z'), paths: ['c.ts', 'a.ts', 'z.ts'] },
        { pull: pull(6, '2026-02-01T00:00:00Z'), paths: ['b.ts'] },
        { pull: pull(7, '2026-03-01T00:00:00Z'), paths: ['other.ts'] },
        { pull: pull(8, null), paths: ['a.ts'] },
      ],
      META,
    );

    // (a) no overlap → excluded; overlap is the sorted intersection.
    // (b) updatedAt desc; null last.
    expect(out.history.map((h) => h.pr_number)).toEqual([6, 5, 8]);
    expect(out.history[1]!.files_overlap).toEqual(['a.ts', 'c.ts']);
    expect(out.history[1]!.notes).toBe('2 shared files');
    expect(out.history[0]!.notes).toBe('1 shared file');
    expect(out.history[0]).toMatchObject({ title: 'PR 6', author: 'dev6' });

    // (c) merged_at from updatedAt; '' for null.
    expect(out.history[0]!.merged_at).toBe('2026-02-01T00:00:00.000Z');
    expect(out.history[2]!.merged_at).toBe('');

    // (d)
    expect(out.candidates).toBe(4);
    expect(out.unchecked).toBe(1);
    expect(out.github_unavailable).toBe(true);

    // (e)
    expect(PrHistory.parse(out)).toEqual(out);
  });

  it('same updatedAt → higher number first; nothing checked → empty history', () => {
    const t = '2026-01-01T00:00:00Z';
    const out = toPrHistory(
      ['a.ts'],
      [
        { pull: pull(3, t), paths: ['a.ts'] },
        { pull: pull(9, t), paths: ['a.ts'] },
      ],
      META,
    );
    expect(out.history.map((h) => h.pr_number)).toEqual([9, 3]);

    const empty = toPrHistory(['a.ts'], [], { candidates: 0, unchecked: 0, githubUnavailable: false });
    expect(empty).toEqual({ history: [], candidates: 0, unchecked: 0, github_unavailable: false });
    expect(PrHistory.parse(empty)).toEqual(empty);
  });
});
