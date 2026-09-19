/**
 * Which Anthropic models still take a `temperature`.
 *
 * This is not a style preference: Anthropic removed the sampling parameters
 * with the current generation, so sending one to Opus 5 or Sonnet 5 fails the
 * whole request with a 400 — every review run against that model, silently
 * recorded as `failed` with a null cost.
 */
import { describe, it, expect } from 'vitest';
import { samplingFor } from '../src/adapters/llm/anthropic.js';

describe('samplingFor', () => {
  it('omits temperature for the models that reject it', () => {
    expect(samplingFor('claude-opus-5', 0.2)).toEqual({});
    expect(samplingFor('claude-sonnet-5', 0)).toEqual({});
  });

  it('keeps it for the models that still accept it', () => {
    expect(samplingFor('claude-haiku-4-5', 0.2)).toEqual({ temperature: 0.2 });
    expect(samplingFor('claude-sonnet-4-6', 0)).toEqual({ temperature: 0 });
  });

  it('omits it for a model it has never heard of', () => {
    // listModels() is a live GET /models, so the studio offers ids this file
    // does not know. Omitting is the recoverable default; a 400 is not.
    expect(samplingFor('claude-something-7', 0.2)).toEqual({});
  });
});
