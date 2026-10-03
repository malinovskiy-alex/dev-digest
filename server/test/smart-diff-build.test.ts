import { describe, it, expect } from 'vitest';
import { SmartDiff } from '@devdigest/shared';
import { buildSmartDiff } from '../src/modules/reviews/smart-diff/helpers.js';
import { ROLE_ORDER } from '../src/modules/reviews/smart-diff/constants.js';

const file = (path: string, additions = 1, deletions = 0) => ({ path, additions, deletions });
/** The PR has no `kind='review'` review yet. */
const NO_REVIEW = { review_id: null, anchors: [] };

describe('buildSmartDiff', () => {
  const shuffled = [
    file('pnpm-lock.yaml', 300, 120),
    file('README.md', 4, 1),
    file('src/config.test.ts', 30, 0),
    file('vitest.config.ts', 2, 2),
    file('src/config.ts', 40, 10),
    file('src/billing.ts', 8, 3),
  ];

  it('(a) emits the five roles in ROLE_ORDER, whatever the input order', () => {
    const d = buildSmartDiff(shuffled, NO_REVIEW);
    expect(d.groups.map((g) => g.role)).toEqual([...ROLE_ORDER]);
    // files keep their input order within a group
    expect(d.groups[0]!.files.map((f) => f.path)).toEqual(['src/config.ts', 'src/billing.ts']);
  });

  it('(b) omits a role with no files', () => {
    const d = buildSmartDiff([file('src/a.ts'), file('src/a.test.ts')], NO_REVIEW);
    expect(d.groups.map((g) => g.role)).toEqual(['core', 'tests']);
    expect(d.groups.find((g) => g.role === 'docs')).toBeUndefined();
  });

  it('(c) dedupes and sorts finding_lines; a file with no findings gets []', () => {
    const d = buildSmartDiff(
      [file('src/a.ts'), file('src/b.ts')],
      {
        review_id: 'rev-1',
        anchors: [
          { file: 'src/a.ts', start_line: 30 },
          { file: 'src/a.ts', start_line: 4 },
          { file: 'src/a.ts', start_line: 30 },
          { file: 'src/a.ts', start_line: 11 },
        ],
      },
    );
    const [a, b] = d.groups[0]!.files;
    expect(a!.finding_lines).toEqual([4, 11, 30]);
    expect(b!.finding_lines).toEqual([]);
  });

  it('(d) ignores an anchor on a path that is not in the PR', () => {
    const d = buildSmartDiff([file('src/a.ts')], {
      review_id: 'rev-1',
      anchors: [{ file: 'src/gone.ts', start_line: 3 }],
    });
    expect(d.groups).toHaveLength(1);
    expect(d.groups[0]!.files).toEqual([
      { path: 'src/a.ts', additions: 1, deletions: 0, finding_lines: [] },
    ]);
  });

  it('(e) split_suggestion is the minimum: total lines, never too big, no splits', () => {
    const d = buildSmartDiff(shuffled, NO_REVIEW);
    expect(d.split_suggestion).toEqual({
      too_big: false,
      total_lines: 300 + 120 + 4 + 1 + 30 + 2 + 2 + 40 + 10 + 8 + 3,
      proposed_splits: [],
    });
  });

  it('(f) a lock-file lands in boilerplate', () => {
    const d = buildSmartDiff(shuffled, NO_REVIEW);
    const boilerplate = d.groups.find((g) => g.role === 'boilerplate');
    expect(boilerplate?.files.map((f) => f.path)).toEqual(['pnpm-lock.yaml']);
  });

  it('(g) the output satisfies the SmartDiff contract and never sets pseudocode_summary', () => {
    const d = buildSmartDiff(shuffled, {
      review_id: 'rev-1',
      anchors: [{ file: 'src/config.ts', start_line: 11 }],
    });
    expect(() => SmartDiff.parse(d)).not.toThrow();
    for (const g of d.groups) {
      for (const f of g.files) expect('pseudocode_summary' in f).toBe(false);
    }
  });

  it('(h) review_id is the latest review the anchors came from, or null when there is none', () => {
    const withReview = buildSmartDiff([file('src/a.ts')], {
      review_id: 'rev-42',
      anchors: [{ file: 'src/a.ts', start_line: 7 }],
    });
    expect(withReview.review_id).toBe('rev-42');
    expect(withReview.groups[0]!.files[0]!.finding_lines).toEqual([7]);

    const noReview = buildSmartDiff([file('src/a.ts')], NO_REVIEW);
    expect(noReview.review_id).toBeNull();
    expect(() => SmartDiff.parse(noReview)).not.toThrow();
  });
});
