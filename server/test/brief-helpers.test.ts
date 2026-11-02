/**
 * PR Brief (L05) — stored brief, read view, call limits (plan step 23d + the
 * pure half of 23e's limit table).
 *
 * Expected values come from R-39, R-41…R-45, R-73 and D-9, D-38; not from the
 * implementation.
 */
import { describe, it, expect } from 'vitest';
import { PrBrief } from '@devdigest/shared';
import { callLimits, isReasoningModel, noKeyMessage, parseStoredBrief, toStoredBrief, toView } from '../src/modules/brief/helpers.js';
import type { BriefFacts } from '../src/modules/brief/types.js';

const CHOICE = { provider: 'openai' as const, model: 'gpt-4.1' };

function facts(over: Partial<BriefFacts> = {}): BriefFacts {
  return {
    title: 't',
    intent: null,
    blast: null,
    rows: [],
    callers: [],
    description: '',
    issue: null,
    specs: [],
    missing: [{ input: 'intent', reason: 'not_derived' }],
    specsBudgetSkipped: [],
    specSkips: [],
    ...over,
  };
}

function stored(headSha = 'sha-1') {
  return toStoredBrief({
    grounded: {
      summary: 'Adds a limiter.',
      risks: [{ kind: 'security', title: 'Bypass', explanation: 'e', severity: 'high', file_refs: ['src/a.ts:3'] }],
      review_focus: [{ file: 'src/a.ts', line: 3, reason: 'core' }],
      dropped: { risks: 1, risk_refs: 2, review_focus: 0 },
      focusLinesMoved: 1,
    },
    facts: facts(),
    choice: CHOICE,
    result: { tokensIn: 1200, tokensOut: 300, costUsd: null },
    trim: {
      specs_removed: ['specs/x.md'],
      description: 'kept',
      callers_removed: 0,
      issue_body: 'kept',
      diff_rows_removed: 0,
      input_tokens: 1500,
    },
    missing: [{ input: 'intent', reason: 'not_derived' }],
    headSha,
    now: new Date('2026-11-01T12:00:00.000Z'),
  });
}

describe('the stored brief (R-41, R-42)', () => {
  it('parses as PrBrief with meta, history null, intent/blast null when missing', () => {
    const b = stored();
    expect(PrBrief.safeParse(b).success).toBe(true);
    expect(b.history).toBeNull();
    expect(b.intent).toBeNull();
    expect(b.blast).toBeNull();
    expect(b.meta).toEqual({
      head_sha: 'sha-1',
      generated_at: '2026-11-01T12:00:00.000Z',
      provider: 'openai',
      model: 'gpt-4.1',
      tokens_in: 1200,
      tokens_out: 300,
      cost_usd: null,
      missing_inputs: [{ input: 'intent', reason: 'not_derived' }],
      trim: {
        specs_removed: ['specs/x.md'],
        description: 'kept',
        callers_removed: 0,
        issue_body: 'kept',
        diff_rows_removed: 0,
        focus_lines_moved: 1,
        input_tokens: 1500,
      },
      dropped: { risks: 1, risk_refs: 2, review_focus: 0 },
    });
    expect(b.summary).toBe('Adds a limiter.');
    expect(b.risks.risks).toHaveLength(1);
    expect(b.review_focus).toEqual([{ file: 'src/a.ts', line: 3, reason: 'core' }]);
  });
});

describe('reading the stored json (R-44)', () => {
  it('a valid brief round-trips through JSON', () => {
    const b = stored();
    expect(parseStoredBrief(JSON.parse(JSON.stringify(b)))).toEqual(b);
  });

  it.each([
    ['{}', {}],
    ['the old starter shape', { intent: null, blast: null, risks: { risks: [] }, history: null }],
    ['a string', 'garbage'],
    ['null', null],
    ['undefined (no row)', undefined],
  ])('%s → null (as if no brief were stored)', (_n, json) => {
    expect(parseStoredBrief(json)).toBeNull();
  });
});

describe('the read view (R-43, R-45, D-9)', () => {
  const base = { generating: false, failure: null, keyAvailable: true, choice: CHOICE };

  it('same head SHA → not stale; all seven fields present', () => {
    const v = toView({ ...base, stored: stored('sha-1'), headSha: 'sha-1' });
    expect(Object.keys(v).sort()).toEqual(
      ['brief', 'current_head_sha', 'feature_model', 'generating', 'key_available', 'last_failure', 'stale'].sort(),
    );
    expect(v.stale).toBe(false);
    expect(v.current_head_sha).toBe('sha-1');
    expect(v.feature_model).toEqual({ provider: 'openai', model: 'gpt-4.1' });
  });

  it('a newer head SHA → stale, the brief still returned', () => {
    const v = toView({ ...base, stored: stored('sha-1'), headSha: 'sha-2' });
    expect(v.stale).toBe(true);
    expect(v.brief?.meta.head_sha).toBe('sha-1');
    expect(v.current_head_sha).toBe('sha-2');
  });

  it('no brief → never stale', () => {
    expect(toView({ ...base, stored: null, headSha: 'sha-2' }).stale).toBe(false);
  });

  it('read-time state is passed through, never stored in the brief', () => {
    const failure = { code: 'timeout' as const, message: 'timed out', at: '2026-11-01T00:00:00Z' };
    const v = toView({ ...base, stored: stored(), headSha: 'sha-1', generating: true, failure, keyAvailable: false });
    expect(v).toMatchObject({ generating: true, last_failure: failure, key_available: false });
    expect(JSON.stringify(v.brief)).not.toMatch(/"(stale|generating|last_failure|key_available)"/);
  });
});

describe('R-39 message', () => {
  it('verbatim', () => {
    expect(noKeyMessage('openai')).toBe(
      'No API key for openai — add one in Settings → API Keys or pick another model for Risk Brief',
    );
  });
});

describe('call limits (R-73, D-38)', () => {
  it.each(['gpt-4.1', 'anthropic/claude-sonnet-4', 'openai/gpt-4o', 'gpt-4o1', 'deepseek/deepseek-v3', 'openai/gpt-4.1-mini'])(
    '%s → 2,000 tokens / 60 s',
    (model) => {
      expect(isReasoningModel(model)).toBe(false);
      expect(callLimits(model)).toEqual({ maxTokens: 2_000, timeoutMs: 60_000, reasoning: false });
    },
  );

  it.each([
    'o3-mini',
    'openai/O4-mini',
    'o1',
    'openai/gpt-5',
    'GPT-5-mini',
    'deepseek/deepseek-r1',
    'deepseek/DeepSeek-V4-flash',
    'qwen/qwq-32b',
    'x/some-thinking-model',
    'vendor/my-reasoning-v2',
    'foo/o1x',
    'a/b/o3',
    'x/y/deepseek-r1',
  ])('%s → 10,000 tokens / 120 s', (model) => {
    expect(isReasoningModel(model)).toBe(true);
    expect(callLimits(model)).toEqual({ maxTokens: 10_000, timeoutMs: 120_000, reasoning: true });
  });

  it('F-23 — the o-prefix counts only at the start of the id segment after the LAST "/"', () => {
    expect(isReasoningModel('gpt-4o1')).toBe(false);
    expect(isReasoningModel('foo/o1x')).toBe(true);
    expect(isReasoningModel('a/b/o3')).toBe(true);
    expect(isReasoningModel('o3/b/gpt-4.1')).toBe(false);
  });
});
