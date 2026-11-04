/**
 * PR Brief (L05) — grounding the model's answer (plan step 23c).
 *
 * Expected values come from R-30…R-35, R-38, R-60, decisions D-13, D-18, D-19
 * and the review-round resolutions F-04 (only model-call errors keep the
 * provider message, secrets masked) and F-12 (call deadline). Never from the
 * implementation.
 */
import { describe, it, expect } from 'vitest';
import type { BlastRadius } from '@devdigest/shared';
import {
  callDeadlineMs,
  classifyGenerationError,
  groundAnswer,
  InvalidOutputError,
  ModelCallError,
  parseRiskRef,
  snapFocusLine,
  StoreFailedError,
  validateAnswer,
} from '../src/modules/brief/grounding/helpers.js';
import { groundingContext, toDiffRows } from '../src/modules/brief/inputs/helpers.js';
import type { BriefModelAnswer } from '../src/modules/brief/schema.js';
import { ConfigError } from '../src/platform/errors.js';
import { TimeoutError } from '../src/platform/resilience.js';

const LONE_HIGH_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/;

// PR file src/a.ts: added runs 10-12 and 20-25. Blast: changed symbol in
// src/sym.ts (no callers), callers in src/x.ts at lines 7 and 13.
const PATCH_A = [
  '@@ -1,0 +10,3 @@',
  '+l10',
  '+l11',
  '+l12',
  '@@ -5,0 +20,6 @@',
  '+l20',
  '+l21',
  '+l22',
  '+l23',
  '+l24',
  '+l25',
].join('\n');

const BLAST: BlastRadius = {
  changed_symbols: [{ name: 's', file: 'src/sym.ts', kind: 'function' }],
  downstream: [
    {
      symbol: 's',
      callers: [
        { name: 'c1', file: 'src/x.ts', line: 13, endpoints: [], crons: [] },
        { name: 'c2', file: 'src/x.ts', line: 7, endpoints: [], crons: [] },
      ],
      endpoints_affected: [],
      crons_affected: [],
    },
  ],
  summary: '1 symbol, 2 callers',
  counts: { symbols: 1, callers: 2, endpoints: 0, crons: 0 },
  degraded: false,
  reason: null,
  index_status: 'full',
  indexed_sha: 'idx',
};

const ROWS = toDiffRows(
  [
    { path: 'src/a.ts', additions: 9, deletions: 0, patch: PATCH_A },
    { path: 'src/nopatch.ts', additions: 0, deletions: 4, patch: null },
  ],
  () => 'core',
);
const CTX = groundingContext(ROWS, BLAST);

const risk = (file_refs: string[], title = 'r') => ({
  kind: 'security',
  title,
  explanation: 'e',
  severity: 'high' as const,
  file_refs,
});
const focus = (file: string, line: number, reason = 'why') => ({ file, line, reason });
const answer = (over: Partial<BriefModelAnswer> = {}): BriefModelAnswer => ({
  summary: 'Adds a limiter.',
  risks: [],
  review_focus: [],
  ...over,
});

// ---------------------------------------------------------------------------

describe('risk ref format (R-32, D-18)', () => {
  it('accepts <path>, <path>:<n>, <path>:<a>-<b> with a ≤ b', () => {
    expect(parseRiskRef('src/a.ts')).toEqual({ path: 'src/a.ts' });
    expect(parseRiskRef('src/a.ts:11')).toMatchObject({ path: 'src/a.ts', start: 11 });
    expect(parseRiskRef('src/a.ts:10-12')).toEqual({ path: 'src/a.ts', start: 10, end: 12 });
    expect(parseRiskRef('src/a.ts:5-5')).toEqual({ path: 'src/a.ts', start: 5, end: 5 });
  });

  it.each(['src/a.ts:0', 'src/a.ts:5-3', 'src/a.ts:x', 'src/a.ts:-3', 'src/a.ts:1.5', ' src/a.ts', ':12', ''])(
    '%j is not a valid ref',
    (ref) => {
      expect(parseRiskRef(ref)).toBeNull();
    },
  );

  it('a malformed ref to a known path is dropped and counted as an unknown path (R-30, R-32)', () => {
    const g = groundAnswer(answer({ risks: [risk(['src/a.ts:0', 'src/a.ts:5-3', 'src/a.ts:x', 'src/a.ts:11'])] }), CTX);
    expect(g.risks).toHaveLength(1);
    expect(g.risks[0]!.file_refs).toEqual(['src/a.ts:11']);
    expect(g.dropped).toEqual({ risks: 0, risk_refs: 3, review_focus: 0 });
  });
});

describe('unknown paths (R-30, R-31, D-18, D-19)', () => {
  it('keeps PR paths, changed-symbol files and caller files; drops the rest and counts them', () => {
    const g = groundAnswer(
      answer({
        risks: [
          risk(['src/a.ts:20-22', 'src/ghost.ts:3', 'src/sym.ts', 'src/x.ts:7'], 'keeps three'),
          risk(['src/ghost.ts', 'invented/b.ts:1'], 'all invented'),
          risk(['./src/a.ts', 'SRC/A.TS'], 'no normalisation'),
        ],
        review_focus: [focus('src/a.ts', 11), focus('src/ghost.ts', 1), focus('src/x.ts', 13)],
      }),
      CTX,
    );
    expect(g.risks.map((r) => r.title)).toEqual(['keeps three']);
    expect(g.risks[0]!.file_refs).toEqual(['src/a.ts:20-22', 'src/sym.ts', 'src/x.ts:7']);
    expect(g.review_focus.map((f) => f.file)).toEqual(['src/a.ts', 'src/x.ts']);
    // risk_refs counts every removed ref, including those of removed risks
    expect(g.dropped).toEqual({ risks: 2, risk_refs: 5, review_focus: 1 });
  });

  it('a risk left with no ref is dropped (R-31); a risk with no ref at all too', () => {
    const g = groundAnswer(answer({ risks: [risk([]), risk(['src/ghost.ts'])] }), CTX);
    expect(g.risks).toEqual([]);
    expect(g.dropped.risks).toBe(2);
  });
});

describe('strict focus validation (R-33, R-38)', () => {
  it.each([
    ['a non-integer line', focus('src/a.ts', 2.5)],
    ['line 0', focus('src/a.ts', 0)],
    ['a negative line', focus('src/a.ts', -4)],
    ['an empty file', focus('', 11)],
    ['a blank file', focus('   ', 11)],
    ['a blank reason', focus('src/a.ts', 11, '  ')],
  ])('%s fails the WHOLE answer', (_name, bad) => {
    const res = validateAnswer(answer({ review_focus: [focus('src/a.ts', 11), bad] }));
    expect(res.ok).toBe(false);
  });

  it('a valid answer passes as is', () => {
    const a = answer({ review_focus: [focus('src/a.ts', 11)], risks: [risk(['src/a.ts'])] });
    expect(validateAnswer(a)).toEqual({ ok: true, answer: a });
  });
});

describe('line snapping (R-34, D-13)', () => {
  it('inside a range → kept, not moved', () => {
    expect(snapFocusLine(focus('src/a.ts', 11), CTX)).toEqual({ line: 11, moved: false });
    expect(snapFocusLine(focus('src/a.ts', 25), CTX)).toEqual({ line: 25, moved: false });
  });

  it('outside → start of the nearest range; tie → the earlier range', () => {
    expect(snapFocusLine(focus('src/a.ts', 15), CTX)).toEqual({ line: 10, moved: true }); // 3 vs 5
    expect(snapFocusLine(focus('src/a.ts', 18), CTX)).toEqual({ line: 20, moved: true }); // 6 vs 2
    expect(snapFocusLine(focus('src/a.ts', 16), CTX)).toEqual({ line: 10, moved: true }); // 4 vs 4 → earlier
    expect(snapFocusLine(focus('src/a.ts', 2), CTX)).toEqual({ line: 10, moved: true });
    expect(snapFocusLine(focus('src/a.ts', 90), CTX)).toEqual({ line: 20, moved: true }); // START of the range
  });

  it('blast-only file → a caller line is kept; otherwise the nearest caller line, tie → earlier', () => {
    expect(snapFocusLine(focus('src/x.ts', 7), CTX)).toEqual({ line: 7, moved: false });
    expect(snapFocusLine(focus('src/x.ts', 12), CTX)).toEqual({ line: 13, moved: true });
    expect(snapFocusLine(focus('src/x.ts', 10), CTX)).toEqual({ line: 7, moved: true }); // 3 vs 3 → earlier
    expect(snapFocusLine(focus('src/x.ts', 1), CTX)).toEqual({ line: 7, moved: true });
  });

  it('a file with neither ranges nor caller lines keeps its line and is not counted', () => {
    expect(snapFocusLine(focus('src/nopatch.ts', 33), CTX)).toEqual({ line: 33, moved: false });
    expect(snapFocusLine(focus('src/sym.ts', 4), CTX)).toEqual({ line: 4, moved: false });
  });

  it('groundAnswer applies the snap and counts the moves', () => {
    const g = groundAnswer(
      answer({ review_focus: [focus('src/a.ts', 15), focus('src/a.ts', 11), focus('src/x.ts', 12), focus('src/sym.ts', 4)] }),
      CTX,
    );
    expect(g.review_focus.map((f) => [f.file, f.line])).toEqual([
      ['src/a.ts', 10],
      ['src/a.ts', 11],
      ['src/x.ts', 13],
      ['src/sym.ts', 4],
    ]);
    expect(g.focusLinesMoved).toBe(2);
  });
});

describe('caps after grounding (R-35, D-18)', () => {
  it('7 risks of which 2 invented → the first 5 KNOWN ones, in the model\'s order', () => {
    const risks = [
      risk(['ghost/1.ts'], 'invented-1'),
      risk(['src/a.ts'], 'k1'),
      risk(['src/a.ts'], 'k2'),
      risk(['ghost/2.ts'], 'invented-2'),
      risk(['src/a.ts'], 'k3'),
      risk(['src/x.ts'], 'k4'),
      risk(['src/sym.ts'], 'k5'),
    ];
    const g = groundAnswer(answer({ risks }), CTX);
    expect(g.risks.map((r) => r.title)).toEqual(['k1', 'k2', 'k3', 'k4', 'k5']);
    expect(g.dropped.risks).toBe(2);
  });

  it('more than 5 known risks → the first 5; overflow is not counted as dropped', () => {
    const risks = Array.from({ length: 7 }, (_, i) => risk(['src/a.ts'], `k${i}`));
    const g = groundAnswer(answer({ risks }), CTX);
    expect(g.risks.map((r) => r.title)).toEqual(['k0', 'k1', 'k2', 'k3', 'k4']);
    expect(g.dropped).toEqual({ risks: 0, risk_refs: 0, review_focus: 0 });
  });

  it('8 focus items with an invented one up front → the first 6 known ones', () => {
    const items = [focus('ghost.ts', 1, 'g'), ...Array.from({ length: 7 }, (_, i) => focus('src/a.ts', 11, `f${i}`))];
    const g = groundAnswer(answer({ review_focus: items }), CTX);
    expect(g.review_focus.map((f) => f.reason)).toEqual(['f0', 'f1', 'f2', 'f3', 'f4', 'f5']);
    expect(g.dropped.review_focus).toBe(1);
  });

  it('summary cut to 600 chars; F-15 — never ends on a lone high surrogate', () => {
    expect(groundAnswer(answer({ summary: 's'.repeat(700) }), CTX).summary).toBe('s'.repeat(600));
    const emoji = groundAnswer(answer({ summary: 'x' + '\u{1F600}'.repeat(400) }), CTX).summary;
    expect(emoji.length).toBeLessThanOrEqual(600);
    expect(LONE_HIGH_SURROGATE.test(emoji)).toBe(false);
  });
});

describe('failure classification (R-38, R-60, F-04)', () => {
  it('invalid answer → invalid_output "The model returned invalid output"', () => {
    expect(classifyGenerationError(new InvalidOutputError())).toEqual({
      code: 'invalid_output',
      message: 'The model returned invalid output',
    });
  });

  it('the model call timed out → timeout "timed out"', () => {
    expect(classifyGenerationError(new ModelCallError(new TimeoutError(60_000)))).toEqual({
      code: 'timeout',
      message: 'timed out',
    });
  });

  it('a provider schema failure from the call → invalid_output', () => {
    const err = new ModelCallError(new Error('MockLLMProvider fixture failed schema: bad'));
    expect(classifyGenerationError(err).code).toBe('invalid_output');
  });

  it('a provider error from the call keeps its message: one line, ≤ 300 chars, secrets masked', () => {
    expect(classifyGenerationError(new ModelCallError(new Error('upstream 503: overloaded')))).toEqual({
      code: 'provider_error',
      message: 'upstream 503: overloaded',
    });
    const long = classifyGenerationError(new ModelCallError(new Error('bad\ngateway ' + 'z'.repeat(500))));
    expect(long.message.length).toBeLessThanOrEqual(300);
    expect(long.message).not.toContain('\n');
    const secret = classifyGenerationError(
      new ModelCallError(new Error('401 Incorrect API key provided: sk-proj-AbCdEf0123456789xyz. Bearer abc.def-ghi')),
    );
    expect(secret.code).toBe('provider_error');
    expect(secret.message).not.toContain('AbCdEf0123456789xyz');
    expect(secret.message).not.toContain('abc.def-ghi');
    expect(secret.message).toContain('401 Incorrect API key provided');
  });

  it('F-04 — any other failure (DB, collection, prompt file) gets the fixed text, never its own message', () => {
    const db = classifyGenerationError(new Error('relation "pr_files" does not exist at /home/me/devdigest/server'));
    expect(db.message).toBe('The brief could not be generated');
    expect(classifyGenerationError(new ConfigError('GITHUB_TOKEN is not configured')).message).toBe(
      'The brief could not be generated',
    );
    expect(classifyGenerationError('a string').message).toBe('The brief could not be generated');
  });

  it('a store failure → store_failed "Could not save the brief"', () => {
    expect(classifyGenerationError(new StoreFailedError(new Error('deadlock detected')))).toEqual({
      code: 'store_failed',
      message: 'Could not save the brief',
    });
  });
});

describe('call deadline (F-12: min(limit, 120000 − 5000 − elapsed))', () => {
  const wall = { wallMs: 120_000, marginMs: 5_000 };
  it('the default model keeps its 60 s when collection was quick', () => {
    expect(callDeadlineMs({ limitMs: 60_000, ...wall, elapsedMs: 300 })).toBe(60_000);
  });
  it('a reasoning model gets ~115 s minus collection time', () => {
    expect(callDeadlineMs({ limitMs: 120_000, ...wall, elapsedMs: 0 })).toBe(115_000);
    expect(callDeadlineMs({ limitMs: 120_000, ...wall, elapsedMs: 2_000 })).toBe(113_000);
  });
  it('a slow collection shrinks even the default model; nothing left → ≤ 0', () => {
    expect(callDeadlineMs({ limitMs: 60_000, ...wall, elapsedMs: 100_000 })).toBe(15_000);
    expect(callDeadlineMs({ limitMs: 60_000, ...wall, elapsedMs: 115_000 })).toBeLessThanOrEqual(0);
  });
});
