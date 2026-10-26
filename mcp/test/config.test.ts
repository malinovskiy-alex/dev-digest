import { describe, expect, it } from 'vitest';
import { isLoopbackUrl } from '../src/config.js';

describe('isLoopbackUrl', () => {
  it.each([
    ['http://localhost:3001', true],
    ['http://LOCALHOST:3001', true],
    ['http://127.0.0.1:3001', true],
    ['http://127.10.20.30', true],
    ['http://[::1]:3001', true],
    ['http://api.localhost:3001', true],
    ['http://127.example.com', false],
    ['http://127.0.0.1.evil.com', false],
    ['https://devdigest.example.com', false],
    ['http://10.0.0.5:3001', false],
  ])('%s → %s', (url, expected) => {
    expect(isLoopbackUrl(url)).toBe(expected);
  });
});
