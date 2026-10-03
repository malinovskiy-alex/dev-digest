import { describe, it, expect } from 'vitest';
import { formatPrAge } from '../src/modules/pulls/index.js';

describe('formatPrAge', () => {
  const now = new Date('2026-10-03T12:00:00Z');

  it('returns a compact age string', () => {
    const age = formatPrAge('2026-10-01T12:00:00Z', now);
    expect(typeof age).toBe('string');
    expect(age.length).toBeGreaterThan(0);
  });

  it('rejects an unparseable date', () => {
    expect(() => formatPrAge('not-a-date', now)).toThrow(/Invalid openedAt/);
  });
});
