/**
 * assemblePrompt — section metadata for the prompt-assembly log. Pins that the
 * metadata carries sizes and provenance only (never text), matches what the
 * model receives, and follows the omit-when-empty contract of each slot.
 */
import { describe, it, expect } from 'vitest';
import { assemblePrompt } from '../src/prompt.js';

const DIFF = '+const secretDiffLine = "do-not-log-me";';
const SPEC = 'PRIVATE SPEC: the launch date is confidential';

describe('assemblePrompt sections', () => {
  it('lists every rendered section in prompt order, with sizes that match the text', () => {
    const { messages, sections } = assemblePrompt({
      system: 'sys',
      task: 'Review PR #1',
      intent: 'Intent: add rate limiting',
      prDescription: 'why',
      skills: ['skill one', 'skill two!'],
      specs: [SPEC],
      diff: DIFF,
    });
    expect(sections.map((s) => s.name)).toEqual([
      'system',
      'task',
      'intent',
      'pr_description',
      'skills',
      'specs',
      'diff',
    ]);
    expect(sections[0]!.chars).toBe(messages[0]!.content.length);
    // The user message is the non-system sections joined by one blank line each.
    const userChars = sections.slice(1).reduce((n, s) => n + s.chars, 0);
    expect(userChars + 2 * (sections.length - 2)).toBe(messages[1]!.content.length);
    expect(sections.find((s) => s.name === 'skills')!.items).toEqual([9, 10]);
  });

  it('never carries section text — only sizes, sources and a fingerprint', () => {
    const { sections } = assemblePrompt({ system: 'sys', specs: [SPEC], diff: DIFF });
    const serialized = JSON.stringify(sections);
    expect(serialized).not.toContain('do-not-log-me');
    expect(serialized).not.toContain('confidential');
    for (const s of sections) {
      expect(Object.keys(s).sort()).toEqual(
        ['approx_tokens', 'chars', 'fingerprint', 'name', 'source', 'trust', ...(s.items ? ['items'] : [])].sort(),
      );
      expect(s.approx_tokens).toBe(Math.ceil(s.chars / 4));
    }
  });

  it('marks author- and repo-derived sections untrusted', () => {
    const { sections } = assemblePrompt({ system: 'sys', prDescription: 'x', diff: DIFF });
    const trust = Object.fromEntries(sections.map((s) => [s.name, s.trust]));
    expect(trust).toEqual({ system: 'trusted', pr_description: 'untrusted', diff: 'untrusted' });
  });

  it('omits empty slots, and the fingerprint changes when the text does', () => {
    const a = assemblePrompt({ system: 'sys', diff: DIFF }).sections;
    expect(a.map((s) => s.name)).toEqual(['system', 'diff']);
    const b = assemblePrompt({ system: 'sys', diff: DIFF + ' ' }).sections;
    expect(b[1]!.fingerprint).not.toBe(a[1]!.fingerprint);
  });
});
