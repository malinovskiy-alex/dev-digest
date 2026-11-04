/**
 * PR Brief (L05) — the stored brief, the read view and the call limits (Ring 1).
 * Computed from arguments alone: no async, no I/O.
 */
import {
  PrBrief,
  type BriefFailure,
  type BriefMissingInput,
  type BriefTrim,
  type FeatureModelChoice,
  type PrBriefView,
} from '@devdigest/shared';
import {
  GENERATION_TIMEOUT_MS,
  OUTPUT_MAX_TOKENS,
  REASONING_MODEL_MARKERS,
  REASONING_MODEL_PREFIXES,
  REASONING_OUTPUT_MAX_TOKENS,
  REASONING_TIMEOUT_MS,
} from './constants.js';
import type { GroundedAnswer } from './grounding/helpers.js';
import type { BriefFacts } from './types.js';

// ---------------------------------------------------------------- stored brief

export interface StoredBriefInput {
  grounded: GroundedAnswer;
  facts: BriefFacts;
  choice: FeatureModelChoice;
  result: { tokensIn: number; tokensOut: number; costUsd: number | null };
  trim: Omit<BriefTrim, 'focus_lines_moved'>;
  missing: BriefMissingInput[];
  headSha: string;
  now: Date;
}

/**
 * The `pr_brief.json` of one generation (R-41, R-42). `PrBrief.parse` on the
 * way out, so a bad shape fails here (→ `store_failed`), never on read.
 */
export function toStoredBrief(i: StoredBriefInput): PrBrief {
  return PrBrief.parse({
    summary: i.grounded.summary,
    intent: i.facts.intent,
    blast: i.facts.blast,
    risks: { risks: i.grounded.risks },
    review_focus: i.grounded.review_focus,
    history: null,
    meta: {
      head_sha: i.headSha,
      generated_at: i.now.toISOString(),
      provider: i.choice.provider,
      model: i.choice.model,
      tokens_in: Math.max(0, Math.round(i.result.tokensIn)),
      tokens_out: Math.max(0, Math.round(i.result.tokensOut)),
      cost_usd: i.result.costUsd,
      missing_inputs: i.missing,
      trim: { ...i.trim, focus_lines_moved: i.grounded.focusLinesMoved },
      dropped: i.grounded.dropped,
    },
  });
}

/** The stored json, or null when it does not parse as a `PrBrief` (R-44). */
export function parseStoredBrief(json: unknown): PrBrief | null {
  if (json === undefined || json === null) return null;
  const parsed = PrBrief.safeParse(json);
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------- read view

export interface ViewInput {
  stored: PrBrief | null;
  headSha: string;
  generating: boolean;
  failure: BriefFailure | null;
  keyAvailable: boolean;
  choice: FeatureModelChoice;
}

/** GET /pulls/:id/brief (R-43, R-45). Everything but `brief` is computed now. */
export function toView(i: ViewInput): PrBriefView {
  return {
    brief: i.stored,
    stale: i.stored !== null && i.stored.meta.head_sha !== i.headSha,
    current_head_sha: i.headSha,
    generating: i.generating,
    last_failure: i.failure,
    key_available: i.keyAvailable,
    feature_model: { provider: i.choice.provider, model: i.choice.model },
  };
}

/** R-39, verbatim. */
export function noKeyMessage(provider: string): string {
  return `No API key for ${provider} — add one in Settings → API Keys or pick another model for Risk Brief`;
}

// ---------------------------------------------------------------- call limits

/**
 * R-73, D-38 (F-23): lower-case the id and keep only the segment after the
 * LAST `/` (`a/b/o3` → `o3`); a reasoning model's stripped id starts with
 * `o1`/`o3`/`o4` or contains one of the markers.
 */
export function isReasoningModel(model: string): boolean {
  const lower = model.toLowerCase();
  const id = lower.slice(lower.lastIndexOf('/') + 1);
  return (
    REASONING_MODEL_PREFIXES.some((p) => id.startsWith(p)) || REASONING_MODEL_MARKERS.some((m) => id.includes(m))
  );
}

/** The output cap and wall of the one call (R-73, D-38). */
export function callLimits(model: string): { maxTokens: number; timeoutMs: number; reasoning: boolean } {
  return isReasoningModel(model)
    ? { maxTokens: REASONING_OUTPUT_MAX_TOKENS, timeoutMs: REASONING_TIMEOUT_MS, reasoning: true }
    : { maxTokens: OUTPUT_MAX_TOKENS, timeoutMs: GENERATION_TIMEOUT_MS, reasoning: false };
}
