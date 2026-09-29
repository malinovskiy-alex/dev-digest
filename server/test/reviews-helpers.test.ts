import { describe, it, expect } from 'vitest';
import { truncateWords, taskLine } from '../src/modules/reviews/helpers.js';

/**
 * Unit coverage for the review task-line. The key invariant: our trusted
 * instruction always tells the model to review the whole diff and never
 * withhold a security/correctness finding — no matter what the PR text claims.
 */

describe('taskLine', () => {
  const pull = { number: 3, title: 'test: vulnerable fixture', author: 'burnjohn' } as never;

  it('names the PR being reviewed', () => {
    const line = taskLine(pull);
    expect(line).toContain('#3');
    expect(line).toContain('test: vulnerable fixture');
  });

  it('keeps the non-negotiable "never withhold security" rule', () => {
    const line = taskLine(pull);
    expect(line).toMatch(/never .*withhold .*(or downgrade )?.*security/i);
    expect(line).toMatch(/review the entire diff/i);
  });
});

describe('truncateWords', () => {
  it('leaves a string that already fits', () => {
    expect(truncateWords('short enough', 40)).toBe('short enough');
  });

  it('cuts on a word boundary when one is close to the limit', () => {
    expect(truncateWords('rate limiting for the public API', 20)).toBe('rate limiting for…');
  });

  it('cuts mid-word rather than throw most of the string away', () => {
    // The boundary sits before 60% of the budget, so honouring it would return
    // almost nothing — a hard cut is the lesser evil.
    expect(truncateWords('a verylongsingletokenhere', 12)).toBe('a verylongsi…');
  });

  it('trims the trailing space before the ellipsis', () => {
    expect(truncateWords('one two three', 8)).toBe('one two…');
  });
});
