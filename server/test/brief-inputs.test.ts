/**
 * PR Brief (L05) — the pure input helpers (plan step 23a).
 *
 * Expected values come from the requirements (R-09, R-26, R-27, R-29, R-64,
 * R-65) and the plan's decisions (D-13, D-14, D-15, D-16, D-17), never from the
 * implementation. Each `it` names what it proves.
 */
import { describe, it, expect } from 'vitest';
import type { BlastRadius, SmartDiffRole } from '@devdigest/shared';
import {
  blastMissing,
  changedLineRanges,
  cutIssueBody,
  descriptionMissing,
  diffMissing,
  flattenCallers,
  formatRanges,
  groundingContext,
  intentMissing,
  normalizeDescription,
  orderMissing,
  parseClosingIssues,
  specsMissing,
  toDiffRows,
  unionSpecPaths,
} from '../src/modules/brief/inputs/helpers.js';
import { parseClosingIssues as reviewsParseClosingIssues } from '../src/modules/reviews/intent/sources.js';

const LONE_HIGH_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/;

function blast(over: Partial<BlastRadius> = {}): BlastRadius {
  return {
    changed_symbols: [{ name: 'limit', file: 'src/limiter.ts', kind: 'function' }],
    downstream: [
      {
        symbol: 'limit',
        callers: [
          { name: 'handler', file: 'src/server.ts', line: 40, endpoints: [], crons: [] },
          { name: 'cron', file: 'src/jobs.ts', line: 7, endpoints: [], crons: [] },
        ],
        endpoints_affected: [],
        crons_affected: [],
      },
      {
        symbol: 'reset',
        callers: [{ name: 'admin', file: 'src/server.ts', line: 12, endpoints: [], crons: [] }],
        endpoints_affected: [],
        crons_affected: [],
      },
    ],
    summary: '2 symbols, 3 callers',
    counts: { symbols: 2, callers: 3, endpoints: 0, crons: 0 },
    degraded: false,
    reason: null,
    index_status: 'full',
    indexed_sha: 'idx',
    ...over,
  };
}

// ---------------------------------------------------------------------------

describe('changed-line ranges (R-09, D-13: runs of ADDED new-side lines)', () => {
  it('two hunks: added runs split by a context line; context advances the counter, deletions do not', () => {
    const patch = [
      '@@ -1,4 +1,6 @@',
      ' a', // 1
      '+b', // 2
      '+c', // 3
      ' d', // 4
      '+e', // 5
      ' f', // 6
      '@@ -20,3 +40,4 @@',
      ' x', // 40
      '-y', // (old side only)
      '+z', // 41
      '+w', // 42
    ].join('\n');
    expect(changedLineRanges(patch)).toEqual([
      [2, 3],
      [5, 5],
      [41, 42],
    ]);
  });

  it('a deletion-only hunk has no ranges; a null patch has no ranges', () => {
    expect(changedLineRanges('@@ -5,2 +4,0 @@\n-gone\n-also gone')).toEqual([]);
    expect(changedLineRanges(null)).toEqual([]);
  });

  it('"\\ No newline at end of file" is not a new-side line', () => {
    const patch = '@@ -1,1 +1,2 @@\n-old\n\\ No newline at end of file\n+new1\n+new2';
    expect(changedLineRanges(patch)).toEqual([[1, 2]]);
  });

  it('formatRanges renders "12-18, 40-52", a one-line run as "40", none as "none"', () => {
    expect(
      formatRanges([
        [12, 18],
        [40, 52],
      ]),
    ).toBe('12-18, 40-52');
    expect(
      formatRanges([
        [12, 18],
        [40, 40],
      ]),
    ).toBe('12-18, 40');
    expect(formatRanges([])).toBe('none');
  });
});

describe('diff rows (R-09, R-26, D-12, D-16)', () => {
  const roleOf = (p: string): SmartDiffRole => (p.includes('test') ? 'tests' : 'core');
  const files = [
    { path: 'src/z.ts', additions: 1, deletions: 0, patch: '@@ -1,0 +1,1 @@\n+z' },
    { path: 'src/a.test.ts', additions: 2, deletions: 1, patch: null },
    { path: 'src/B.ts', additions: 0, deletions: 3, patch: '@@ -1,3 +0,0 @@\n-a\n-b\n-c' },
    { path: 'src/a.ts', additions: 3, deletions: 1, patch: '@@ -1,2 +1,4 @@\n x\n+a\n+b\n+c\n-y' },
  ];

  it('rows are path-ascending (code-unit order) whatever the input order, with role, stats and ranges', () => {
    const rows = toDiffRows(files, roleOf);
    expect(rows.map((r) => r.path)).toEqual(['src/B.ts', 'src/a.test.ts', 'src/a.ts', 'src/z.ts']);
    expect(rows.find((r) => r.path === 'src/a.ts')).toEqual({
      path: 'src/a.ts',
      role: 'core',
      additions: 3,
      deletions: 1,
      ranges: [[2, 4]],
    });
    expect(rows.find((r) => r.path === 'src/a.test.ts')!.role).toBe('tests');
    expect(rows.find((r) => r.path === 'src/B.ts')!.ranges).toEqual([]);
  });

  it('the same files in any order give identical rows (R-26)', () => {
    const a = toDiffRows(files, roleOf);
    const b = toDiffRows([...files].reverse(), roleOf);
    const c = toDiffRows([files[2]!, files[0]!, files[3]!, files[1]!], roleOf);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it('rows carry no patch text (INV-9)', () => {
    const rows = toDiffRows(
      [{ path: 'a.ts', additions: 1, deletions: 0, patch: '@@ -1,0 +1,1 @@\n+SECRET_MARKER_42' }],
      roleOf,
    );
    expect(JSON.stringify(rows)).not.toContain('SECRET_MARKER_42');
    expect(JSON.stringify(rows)).not.toContain('@@');
  });
});

describe('linked issue (R-64, D-14)', () => {
  const FIXTURES = [
    'Closes #12',
    'closes #12 and fixes #13',
    'Fixes: #7',
    'RESOLVED #99',
    'resolves #1, closes #1',
    'See #12 for context',
    'Refs #5',
    'fix #0',
    'prefixcloses #4',
    'Fixed #3\nresolve #8',
    'closes#12',
    'Closes https://github.com/acme/api/issues/12',
    'closes #12345678',
    '',
    'Close #21. Fixes #22! Resolve #23?',
  ];

  it.each(FIXTURES)('parity with reviews/intent: %j', (text) => {
    expect(parseClosingIssues(text)).toEqual(reviewsParseClosingIssues(text));
  });

  it('only closing keywords count; first number first, no duplicates', () => {
    expect(parseClosingIssues('See #5. Closes #12, fixes #13, closes #12')).toEqual([12, 13]);
    expect(parseClosingIssues('Related to #4')).toEqual([]);
  });

  it('the issue body is cut to 4,000 characters (R-64)', () => {
    expect(cutIssueBody('x'.repeat(5000))).toBe('x'.repeat(4000));
    expect(cutIssueBody(null)).toBe('');
  });

  it('F-15 — the 4,000-char cut never leaves a lone high surrogate', () => {
    const body = 'x' + '\u{1F600}'.repeat(2500); // the cut lands inside a pair
    const cut = cutIssueBody(body);
    expect(cut.length).toBeLessThanOrEqual(4000);
    expect(LONE_HIGH_SURROGATE.test(cut)).toBe(false);
  });
});

describe('description (D-12)', () => {
  it('CRLF normalised and trimmed; blank → "" → missing `empty`', () => {
    expect(normalizeDescription('  Adds a limiter.\r\n\r\nCloses #12.\r\n ')).toBe('Adds a limiter.\n\nCloses #12.');
    expect(normalizeDescription(' \r\n ')).toBe('');
    expect(normalizeDescription(null)).toBe('');
    expect(descriptionMissing('')).toEqual({ input: 'description', reason: 'empty' });
    expect(descriptionMissing('text')).toBeNull();
  });
});

describe('attached specs (R-65, D-15)', () => {
  it('union of every agent\'s own and skill documents, de-duplicated, path ascending', () => {
    const union = unionSpecPaths(
      [['specs/b.md', 'specs/a.md'], ['specs/b.md']],
      [[{ paths: ['docs/z.md', 'specs/a.md'] }], [{ paths: ['Docs/c.md'] }, { paths: [] }]],
    );
    expect(union).toEqual(['Docs/c.md', 'docs/z.md', 'specs/a.md', 'specs/b.md']);
  });

  it('specs missing reasons: none_attached / not_cloned / read_error; a partial resolve is not missing', () => {
    expect(specsMissing([], { docs: [], skipped: [] })).toEqual({ input: 'specs', reason: 'none_attached' });
    expect(specsMissing(['a.md'], { docs: [], skipped: [{ reason: 'not_cloned' }] })).toEqual({
      input: 'specs',
      reason: 'not_cloned',
    });
    expect(specsMissing(['a.md'], { docs: [], skipped: [{ reason: 'read_error' }] })).toEqual({
      input: 'specs',
      reason: 'read_error',
    });
    expect(specsMissing(['a.md'], { docs: [], skipped: [{ reason: 'not_found' }] })).toEqual({
      input: 'specs',
      reason: 'read_error',
    });
    expect(specsMissing(['a.md', 'b.md'], { docs: [{}], skipped: [{ reason: 'read_error' }] })).toBeNull();
  });

  it('a spec skipped only by the project-context section budget is not a missing input (R-27, AP-7)', () => {
    expect(specsMissing(['a.md'], { docs: [], skipped: [{ reason: 'budget' }] })).toBeNull();
  });
});

describe('missing inputs (R-27, R-29, D-17)', () => {
  it('intent: no stored record → not_derived', () => {
    expect(intentMissing(null)).toEqual({ input: 'intent', reason: 'not_derived' });
    expect(intentMissing({ intent: 'x' })).toBeNull();
  });

  it('R-29 — a full index with zero callers is NOT missing', () => {
    const empty = blast({ downstream: [], counts: { symbols: 1, callers: 0, endpoints: 0, crons: 0 } });
    expect(blastMissing(empty)).toBeNull();
  });

  it('blast: no_data → no_index; other reasons → degraded:<reason>; null reason → degraded:unknown; a throw → degraded:error', () => {
    expect(blastMissing(blast({ degraded: true, reason: 'no_data' }))).toEqual({ input: 'blast', reason: 'no_index' });
    expect(blastMissing(blast({ degraded: true, reason: 'index_partial' }))).toEqual({
      input: 'blast',
      reason: 'degraded:index_partial',
    });
    expect(blastMissing(blast({ degraded: true, reason: null }))).toEqual({ input: 'blast', reason: 'degraded:unknown' });
    expect(blastMissing('error')).toEqual({ input: 'blast', reason: 'degraded:error' });
  });

  it('diff stats: no rows → no_files', () => {
    expect(diffMissing([])).toEqual({ input: 'diff_stats', reason: 'no_files' });
  });

  it('listed in the fixed order intent, blast, diff_stats, description, issue, specs (D-16)', () => {
    const ordered = orderMissing([
      { input: 'specs', reason: 'none_attached' },
      null,
      { input: 'issue', reason: 'none_linked' },
      { input: 'intent', reason: 'not_derived' },
      { input: 'description', reason: 'empty' },
      { input: 'diff_stats', reason: 'no_files' },
      { input: 'blast', reason: 'no_index' },
    ]);
    expect(ordered.map((m) => m.input)).toEqual(['intent', 'blast', 'diff_stats', 'description', 'issue', 'specs']);
  });
});

describe('blast callers and the grounding context (D-12, D-18)', () => {
  it('callers flattened in blast order: downstream[i].callers[j]', () => {
    expect(flattenCallers(blast())).toEqual([
      { name: 'handler', file: 'src/server.ts', line: 40 },
      { name: 'cron', file: 'src/jobs.ts', line: 7 },
      { name: 'admin', file: 'src/server.ts', line: 12 },
    ]);
    expect(flattenCallers(null)).toEqual([]);
  });

  it('known paths = PR paths ∪ changed-symbol files ∪ caller files; caller lines ascending per file', () => {
    const rows = toDiffRows([{ path: 'src/a.ts', additions: 1, deletions: 0, patch: '@@ -0,0 +3,1 @@\n+x' }], () => 'core');
    const ctx = groundingContext(rows, blast());
    expect([...ctx.prPaths]).toEqual(['src/a.ts']);
    expect([...ctx.blastPaths].sort()).toEqual(['src/jobs.ts', 'src/limiter.ts', 'src/server.ts']);
    expect(ctx.callerLines.get('src/server.ts')).toEqual([12, 40]);
    expect(ctx.ranges.get('src/a.ts')).toEqual([[3, 3]]);
  });
});
