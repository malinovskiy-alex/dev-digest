/**
 * Intent sources — the pure half of the intent layer. Pins the rules the
 * review checklist asks for:
 *  - an empty description gives the classifier hunk HEADERS, never changed lines;
 *  - referenced tickets / specs are recorded, and an unavailable one is said
 *    out loud (to the classifier, in the review prompt), never silently dropped;
 *  - a Jira key is found however the author capitalises the keyword.
 */
import { describe, it, expect } from 'vitest';
import type { IntentSource, PrIntentRecord } from '@devdigest/shared';
import {
  buildClassifierInput,
  capHunks,
  extractHunkHeaders,
  formatIntentForPrompt,
  missingContext,
  parseExternalTickets,
  type IntentInputs,
} from '../src/modules/reviews/intent/sources.js';

const PATCH = [
  '@@ -10,6 +10,9 @@ export function checkRateLimit(ip: string) {',
  '   const entry = hits.get(ip);',
  '+  const SECRET_CHANGED_LINE = "sk-do-not-send";',
  '-  return { ok: true };',
  '@@ -40,2 +43,4 @@ function reset()',
  '+  hits.clear();',
].join('\n');

function inputs(over: Partial<IntentInputs> = {}): IntentInputs {
  return {
    title: 'Add limiter',
    description: '',
    meaningfulDescription: false,
    branch: 'feat/limiter',
    commits: ['feat: limiter'],
    files: [{ path: 'src/limiter.ts', additions: 3, deletions: 1 }],
    hunks: [],
    ticket: null,
    specs: [],
    unavailable: [],
    ...over,
  };
}

describe('parseExternalTickets', () => {
  it('finds a Jira key after an upper-case keyword and filler words', () => {
    expect(parseExternalTickets('Ticket: see JIRA DEV-4521. Plan: specs/x.md')).toEqual(['DEV-4521']);
    expect(parseExternalTickets('Fixes PROJ-12')).toEqual(['PROJ-12']);
    expect(parseExternalTickets('refs: ABC-1')).toEqual(['ABC-1']);
  });

  it('still ignores key-shaped words with no ticket keyword', () => {
    expect(parseExternalTickets('Encode as UTF-8 and hash with SHA-256')).toEqual([]);
  });

  it('does not turn prose after a fix keyword into a ticket', () => {
    expect(parseExternalTickets('Fixes crash in SHA-256 hashing')).toEqual([]);
    expect(parseExternalTickets('fix bug with UTF-8 decoding')).toEqual([]);
    expect(parseExternalTickets('Fixes UTF-8 handling')).toEqual([]);
  });

  it('records Jira / Linear / Notion URLs as they are', () => {
    expect(parseExternalTickets('see https://acme.atlassian.net/browse/DEV-9')).toEqual([
      'https://acme.atlassian.net/browse/DEV-9',
    ]);
  });
});

describe('hunk headers', () => {
  it('keeps only the @@ lines of a patch', () => {
    expect(extractHunkHeaders(PATCH)).toEqual([
      '@@ -10,6 +10,9 @@ export function checkRateLimit(ip: string) {',
      '@@ -40,2 +43,4 @@ function reset()',
    ]);
    expect(extractHunkHeaders(null)).toEqual([]);
  });

  it('caps the total number of headers across files', () => {
    const many = Array.from({ length: 100 }, (_, i) => `@@ -${i},1 +${i},1 @@`).join('\n');
    const out = capHunks([
      { path: 'a.ts', patch: many },
      { path: 'b.ts', patch: many },
    ]);
    expect(out.reduce((n, h) => n + h.headers.length, 0)).toBe(60);
    expect(out.map((h) => h.path)).toEqual(['a.ts']);
  });

  it('reach the classifier as headers only — never a changed line', () => {
    const { text, sections } = buildClassifierInput(
      inputs({ hunks: [{ path: 'src/limiter.ts', headers: extractHunkHeaders(PATCH) }] }),
    );
    expect(text).toContain('### Hunk headers');
    expect(text).toContain('@@ -40,2 +43,4 @@ function reset()');
    expect(text).not.toContain('sk-do-not-send');
    expect(text).not.toContain('hits.clear()');
    expect(sections.map((s) => s.name)).toContain('hunks');
  });
});

describe('unavailable references', () => {
  const sources: IntentSource[] = [
    { type: 'description', ref: 'description', status: 'used' },
    { type: 'spec', ref: 'specs/plan.md', status: 'failed', reason: 'not_found' },
    { type: 'ticket', ref: 'DEV-4521', status: 'unresolved', reason: 'external' },
    { type: 'spec', ref: 'specs/long.md', status: 'used', reason: 'truncated' },
    { type: 'spec', ref: 'specs/ok.md', status: 'used' },
  ];

  it('missingContext lists failed, unfetched and truncated tickets/specs — nothing else', () => {
    expect(missingContext(sources).map((m) => m.ref)).toEqual(['specs/plan.md', 'DEV-4521', 'specs/long.md']);
  });

  it('are named to the classifier with an instruction not to guess', () => {
    const { text } = buildClassifierInput(
      inputs({ unavailable: [{ type: 'spec', ref: 'specs/plan.md', reason: 'not_found' }] }),
    );
    expect(text).toContain('## Referenced but unavailable');
    expect(text).toContain('Do not guess');
    expect(text).toContain('spec specs/plan.md — not_found');
  });

  it('are named in the review prompt as missing context', () => {
    const record: PrIntentRecord = {
      pr_id: 'p',
      intent: 'Add a limiter',
      in_scope: [],
      out_of_scope: [],
      risk_areas: [],
      conflicts: [],
      confidence: 'medium',
      sources,
    } as PrIntentRecord;
    const text = formatIntentForPrompt(record);
    expect(text).toMatch(/Missing context .*spec specs\/plan\.md \(not_found\).*ticket DEV-4521 \(external\)/);
  });

  it('a low intent with a real description is not called "no description"', () => {
    const base = {
      pr_id: 'p',
      intent: 'x',
      in_scope: [],
      out_of_scope: [],
      risk_areas: [],
      conflicts: [],
      confidence: 'low',
    } as unknown as PrIntentRecord;
    const withDescription = formatIntentForPrompt({ ...base, sources });
    expect(withDescription).toContain('thin or contradict');
    expect(withDescription).not.toContain('no usable description');
    const without = formatIntentForPrompt({
      ...base,
      sources: [{ type: 'description', ref: 'description', status: 'failed', reason: 'empty' }],
    });
    expect(without).toContain('no usable description');
  });

  it('a truncated spec is marked TRUNCATED in the classifier input', () => {
    const { text } = buildClassifierInput(
      inputs({ specs: [{ path: 'specs/long.md', content: 'start of plan', truncated: true }] }),
    );
    expect(text).toMatch(/Linked spec: specs\/long\.md .*TRUNCATED/);
  });
});
