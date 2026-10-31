/**
 * context-docs — the pure path rule shared by project-context, agents and
 * skills, plus project-context's prompt helpers (truncation, merge order).
 */
import { describe, it, expect } from 'vitest';
import {
  CONTEXT_DOC_EXCLUDED_DIRS,
  ContextDocLinksBody,
  docCategory,
  isContextDocPath,
} from '../src/modules/_shared/context-docs/helpers.js';
import { EXCLUDED_DIRS } from '../src/modules/repo-intel/constants.js';
import { applyPromptBudget, budgetChars, mergePromptDocs, truncateForPrompt } from '../src/modules/project-context/helpers.js';
import { MAX_CONTEXT_DOC_CHARS, MAX_CONTEXT_TOTAL_CHARS } from '../src/modules/project-context/constants.js';

describe('isContextDocPath', () => {
  it.each(['docs/a.md', 'README.MD', 'README.md', 'specs/deep/x.Md'])('accepts %j', (p) => {
    expect(isContextDocPath(p)).toBe(true);
  });

  it.each([
    ['../x.md', 'parent segment'],
    ['docs/../x.md', 'inner parent segment'],
    ['./x.md', 'dot segment'],
    ['/abs.md', 'absolute'],
    ['a\\b.md', 'backslash'],
    ['x.txt', 'not markdown'],
    ['docs/a.md.txt', 'markdown not last'],
    ['node_modules/a.md', 'excluded dir at root'],
    ['pkg/dist/a.md', 'excluded dir nested'],
    ['vendor/x/a.md', 'vendor'],
    ['.git/a.md', '.git'],
    ['Vendor/a.md', 'excluded dir, other case (F-20)'],
    ['Build/x.md', 'excluded dir, capitalised (F-20)'],
    ['Node_Modules/y.md', 'excluded dir, mixed case (F-20)'],
    ['pkg/DIST/z.md', 'excluded dir nested, upper case (F-20)'],
    ['a//b.md', 'empty segment'],
    ['-rf.md', 'option-shaped'],
    ['C:/x.md', 'drive colon'],
    ['a\0b.md', 'NUL'],
    ['', 'empty'],
    [`${'a/'.repeat(511)}xy.md`, 'over 1024 chars'],
  ])('rejects %j (%s)', (p) => {
    expect(isContextDocPath(p)).toBe(false);
  });

  it('accepts exactly 1024 characters', () => {
    const p = `${'a'.repeat(1021)}.md`;
    expect(p).toHaveLength(1024);
    expect(isContextDocPath(p)).toBe(true);
  });
});

describe('CONTEXT_DOC_EXCLUDED_DIRS', () => {
  it('stays equal to repo-intel EXCLUDED_DIRS (the copy the comment promises to pin)', () => {
    expect([...CONTEXT_DOC_EXCLUDED_DIRS]).toEqual([...EXCLUDED_DIRS]);
  });
});

describe('docCategory', () => {
  it('is the first folder, or root at the repo root', () => {
    expect(docCategory('specs/feature/a.md')).toBe('specs');
    expect(docCategory('docs/a.md')).toBe('docs');
    expect(docCategory('README.md')).toBe('root');
  });
});

describe('ContextDocLinksBody', () => {
  it('rejects a duplicate path and a bad path, accepts an ordered list', () => {
    expect(
      ContextDocLinksBody.safeParse({ docs: [{ path: 'a.md', enabled: true }, { path: 'a.md', enabled: false }] })
        .success,
    ).toBe(false);
    expect(ContextDocLinksBody.safeParse({ docs: [{ path: '../a.md', enabled: true }] }).success).toBe(false);
    expect(
      ContextDocLinksBody.safeParse({ docs: [{ path: 'b.md', enabled: true }, { path: 'a.md', enabled: false }] })
        .success,
    ).toBe(true);
  });
});

describe('truncateForPrompt', () => {
  it('leaves 32,000 characters untouched', () => {
    const text = 'x'.repeat(MAX_CONTEXT_DOC_CHARS);
    expect(MAX_CONTEXT_DOC_CHARS).toBe(32_000);
    expect(truncateForPrompt(text)).toEqual({ text, truncated: false });
  });

  it('cuts 32,001 characters to 32,000 plus a visible marker', () => {
    const text = 'x'.repeat(32_000) + 'Y';
    const out = truncateForPrompt(text);
    expect(out.truncated).toBe(true);
    expect(out.text).toBe(`${'x'.repeat(32_000)}\n\n[truncated: first 32,000 of 32,001 characters]`);
    expect(out.text).not.toContain('Y');
  });
});

describe('mergePromptDocs', () => {
  it('puts agent docs first, follows skill order, keeps the first occurrence', () => {
    const merged = mergePromptDocs({
      agent: ['docs/agent.md', 'docs/shared.md'],
      skills: [
        { skillName: 'Security', paths: ['docs/sec.md', 'docs/shared.md'] },
        { skillName: 'Perf', paths: ['docs/perf.md', 'docs/sec.md'] },
      ],
    });
    expect(merged).toEqual([
      { path: 'docs/agent.md', via: 'agent' },
      { path: 'docs/shared.md', via: 'agent' },
      { path: 'docs/sec.md', via: 'Security' },
      { path: 'docs/perf.md', via: 'Perf' },
    ]);
  });
});

describe('applyPromptBudget (R-73)', () => {
  const doc = (path: string, n: number) => ({ path, text: 'x'.repeat(n) });

  it('the default budget is 128,000 characters', () => {
    expect(MAX_CONTEXT_TOTAL_CHARS).toBe(128_000);
  });

  it('a total exactly at the budget keeps every document', () => {
    const docs = [doc('a.md', 32_000), doc('b.md', 32_000), doc('c.md', 32_000), doc('d.md', 32_000)];
    expect(applyPromptBudget(docs)).toEqual({ kept: docs, over: [] });
  });

  it('one character over: the first misfit and every later doc go over, even one that would still fit', () => {
    const docs = [doc('a.md', 60_000), doc('b.md', 60_000), doc('c.md', 8_001), doc('d.md', 1)];
    const { kept, over } = applyPromptBudget(docs);
    expect(kept.map((d) => d.path)).toEqual(['a.md', 'b.md']);
    expect(over.map((d) => d.path)).toEqual(['c.md', 'd.md']);
  });

  it('honours an explicit budget', () => {
    const docs = [doc('a.md', 3), doc('b.md', 3)];
    expect(applyPromptBudget(docs, 5)).toEqual({ kept: [docs[0]], over: [docs[1]] });
  });

  it('no documents → nothing kept, nothing over', () => {
    expect(applyPromptBudget([])).toEqual({ kept: [], over: [] });
  });
});

describe('budgetChars (F-29)', () => {
  it('counts a document at most at the 32,000-character cut, never the truncation marker', () => {
    expect(budgetChars({ chars: 50_000 })).toBe(32_000);
    expect(budgetChars({ chars: 32_000 })).toBe(32_000);
    expect(budgetChars({ chars: 12 })).toBe(12);
  });

  it('four documents over 32,000 characters, each truncated with its marker, all fit the 128,000 budget', () => {
    const docs = ['a.md', 'b.md', 'c.md', 'd.md'].map((path, i) => {
      const raw = 'x'.repeat(32_001 + i * 10_000);
      return { path, chars: raw.length, ...truncateForPrompt(raw) };
    });
    // the prompt text (cut + marker) is over the budget on its own: counted by text.length the 4th would drop
    expect(docs.every((d) => d.truncated && d.text.length > 32_000)).toBe(true);
    expect(applyPromptBudget(docs).kept).toHaveLength(3);
    expect(applyPromptBudget(docs, MAX_CONTEXT_TOTAL_CHARS, budgetChars)).toEqual({ kept: docs, over: [] });
  });

  it('a fifth document of one character goes over', () => {
    const big = ['a.md', 'b.md', 'c.md', 'd.md'].map((path) => ({ path, chars: 40_000, text: '' }));
    const fifth = { path: 'e.md', chars: 1, text: 'e' };
    expect(applyPromptBudget([...big, fifth], MAX_CONTEXT_TOTAL_CHARS, budgetChars)).toEqual({ kept: big, over: [fifth] });
  });
});
