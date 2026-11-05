/** Constants for the PR Brief block (L05). */

/** Error code of a generation rejected for a missing key (R-39, D-8). */
export const NO_KEY_CODE = "brief_no_api_key";

/** How often "Generated … ago" re-renders, so the relative time keeps moving — one shared value (L08 F-15). */
export { NOW_TICK_MS } from "@/lib/now-tick";

/** Missing-input reasons with a label in `brief.missingReason.*` (D-17). */
export const KNOWN_MISSING_REASONS = [
  "not_derived",
  "no_index",
  "no_files",
  "empty",
  "none_linked",
  "github_unavailable",
  "fetch_failed",
  "none_attached",
  "not_cloned",
  "read_error",
] as const;

/** Prefix of the parametrised reason `degraded:<reason>` (D-17). */
export const DEGRADED_PREFIX = "degraded:";
