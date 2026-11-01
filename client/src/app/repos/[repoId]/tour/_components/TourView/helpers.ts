/** Pure helpers for the Onboarding Tour view. */

/** Index reason codes with their own text; anything else is shown raw (D-24). */
const KNOWN_INDEX_REASONS = new Set([
  "no_data",
  "no_clone",
  "no_files",
  "index_failed",
  "repo_too_large",
  "flag_off",
  "not_ranked",
]);

/** Whether an index reason code has a translation under `indexReason.*`. */
export function isKnownIndexReason(code: string): boolean {
  return KNOWN_INDEX_REASONS.has(code);
}
