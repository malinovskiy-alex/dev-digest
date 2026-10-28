import type { BlastDegradedReason } from "@devdigest/shared";

/**
 * The degraded reasons as a runtime list (each has a `reason.<key>` message).
 * Local on purpose: a runtime import from `@devdigest/shared` breaks the Next
 * bundle (see src/lib/skill-types.ts). The check below fails to compile when
 * the contract gains a reason this list lacks.
 */
export const DEGRADED_REASONS = [
  "flag_off",
  "index_failed",
  "index_partial",
  "repo_too_large",
  "no_data",
] as const satisfies readonly BlastDegradedReason[];

type MissingReason = Exclude<BlastDegradedReason, (typeof DEGRADED_REASONS)[number]>;
const _allReasonsListed: MissingReason extends never ? true : never = true;
void _allReasonsListed;

/** Which picture of the blast radius the card shows. Not persisted (D16). */
export type BlastView = "tree" | "graph";
