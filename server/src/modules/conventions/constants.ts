import { z } from 'zod';
import { ConventionCategory } from '@devdigest/shared';

/**
 * Conventions extractor — the knobs, the probe list and the ONE schema the
 * model answers in. See specs/L02-conventions-extractor.md.
 */

/**
 * Config and house-rules files probed by path, in this order. These are where a
 * project states its conventions outright, so they are worth more per token than
 * any source file — a repo with an `AGENTS.md` has already written half the
 * answer. Missing files are skipped silently; a repo with none of them still
 * scans, on source samples alone.
 */
export const CONFIG_PROBE_PATHS = [
  'package.json',
  'tsconfig.json',
  '.editorconfig',
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.cjs',
  '.eslintrc.js',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.ts',
  '.prettierrc',
  '.prettierrc.json',
  'prettier.config.js',
  'CONTRIBUTING.md',
  'AGENTS.md',
  'CLAUDE.md',
] as const;

/** Top-ranked source files pulled from `repoIntel.getConventionSamples`. */
export const SOURCE_SAMPLE_COUNT = 12;

/** Per-file excerpt caps. A sample is a taste of a file, not the file. */
export const SAMPLE_LINE_CAP = 160;
export const SAMPLE_CHAR_CAP = 6_000;

/**
 * The widest evidence span a candidate may claim. A rule whose proof needs 40
 * lines is not a convention, it is a code tour — and the card has no room for
 * one.
 */
export const EVIDENCE_LINE_CAP = 40;

/** Upper bound on what one scan stores, after verification and de-duplication. */
export const MAX_CANDIDATES = 12;

/** Names the structured call; `MockLLMOptions.structuredBySchema` keys on it. */
export const EXTRACTION_SCHEMA_NAME = 'ConventionExtraction';

/** The system prompt template (`src/prompts/`). */
export const EXTRACTION_PROMPT_FILE = 'conventions.system.md';

/** Deterministic extraction: the same repo should yield the same rules. */
export const EXTRACTION_TEMPERATURE = 0;

export const EXTRACTION_MAX_TOKENS = 4_000;

/** Reading a whole repo is slow; the default 60s cap trips on real samples. */
export const EXTRACTION_TIMEOUT_MS = 120_000;

/**
 * What the model answers with — INTERNAL, deliberately not a shared contract.
 * Nothing outside this module ever sees an unverified candidate: `verify.ts`
 * turns these into `ConventionCandidate` rows or drops them.
 *
 * `.describe()` carries field MEANING (the provider sends this schema as the
 * response format, so the descriptions reach the model); the prompt file carries
 * judgment — what counts as a convention and what does not.
 */
export const ExtractedConvention = z.object({
  category: ConventionCategory.describe('Which aspect of the codebase the rule governs.'),
  rule: z
    .string()
    .min(8)
    .describe(
      'The convention as one imperative sentence a reviewer could apply, e.g. ' +
        '"Always use async/await instead of .then() chains".',
    ),
  evidence_path: z
    .string()
    .describe('Path of a file from the samples below — copied exactly, never invented.'),
  evidence_start_line: z
    .number()
    .int()
    .min(1)
    .describe('First line of the excerpt that shows the rule, as numbered in the sample.'),
  evidence_end_line: z.number().int().min(1).describe('Last line of that excerpt.'),
  evidence_snippet: z
    .string()
    .describe('Those lines, copied verbatim from the sample — no reformatting, no ellipsis.'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('How consistently the samples follow this rule. 1.0 means every relevant file does.'),
});
export type ExtractedConvention = z.infer<typeof ExtractedConvention>;

export const ExtractionResponse = z.object({
  conventions: z.array(ExtractedConvention),
});
export type ExtractionResponse = z.infer<typeof ExtractionResponse>;
