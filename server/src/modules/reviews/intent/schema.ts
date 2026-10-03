import { z } from 'zod';
import { IntentKind } from '@devdigest/shared';
import { MAX_INTENT_CHARS, MAX_LIST_ITEMS } from './constants.js';

/**
 * What the intent classifier answers with — INTERNAL, not a shared contract.
 * The service clamps it and adds confidence + sources before anything leaves
 * this folder.
 *
 * Limits are stated in `.describe()` (which reaches the model through the
 * response format) and ENFORCED by clamping after parse, not by `.max()`:
 * strict json_schema mode on some providers rejects `maxItems`/`maxLength`,
 * and a whole-call failure over an over-long list is a worse outcome than a
 * trimmed one.
 */
const list = (meaning: string) =>
  z.array(z.string()).describe(`${meaning} At most ${MAX_LIST_ITEMS} short items; an empty list is allowed.`);

export const IntentLLMOutput = z.object({
  intent: z
    .string()
    .describe(
      `One or two sentences (at most ${MAX_INTENT_CHARS} characters): what this PR changes and why.`,
    ),
  kind: IntentKind.describe('The single category that best describes the change.'),
  in_scope: list('Areas of the codebase the author meant to change.'),
  out_of_scope: list(
    'Areas the author explicitly or clearly did NOT mean to change. Leave empty rather than guess.',
  ),
  risk_areas: list('Short labels for what could break (e.g. "auth middleware", "DB migration").'),
  conflicts: list(
    'Each point where a linked spec/plan contradicts the PR description. Empty when there is none.',
  ),
  ambiguous: z
    .boolean()
    .describe('True when the sources are too thin or contradictory to state the intent with confidence.'),
});
export type IntentLLMOutput = z.infer<typeof IntentLLMOutput>;
