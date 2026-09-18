import type { Severity } from "@devdigest/shared";

/**
 * Order every severity row in the app renders in, worst first.
 *
 * Deliberately three entries. The vendored UI token map (`SEV`) carries a
 * fourth, `INFO`, and so does `FindingsPanel/constants.ts:SEVERITY_ORDER` —
 * but the API contract's `Severity` enum cannot emit it, so nothing here
 * should grow a fourth bucket to match.
 */
export const SEVERITY_DISPLAY_ORDER: readonly Severity[] = [
  "CRITICAL",
  "WARNING",
  "SUGGESTION",
] as const;
