/**
 * agent-performance module (L08) — literals.
 */

/** The only run status that counts toward any figure (R-02). */
export const COUNTED_RUN_STATUS = 'done';

/**
 * Sparkline grain → the Postgres `date_trunc` unit and the `to_char` format of
 * the bucket key (D-18). The key of this map is the zod-validated `bucket`
 * enum; the values never come from input. The key formats match the client's
 * `fillBuckets` ('YYYY-MM-DD' / 'YYYY-MM-DDTHH', local to the requested tz).
 */
export const BUCKET_SQL = {
  hour: { unit: 'hour', fmt: 'YYYY-MM-DD"T"HH24' },
  day: { unit: 'day', fmt: 'YYYY-MM-DD' },
} as const;

/** Label of the folded deleted-agents row, used only as a sort tie-breaker here; the client renders its own text. */
export const DELETED_AGENTS_SORT_LABEL = 'Deleted agents';

/** Sort label of a by-model segment without a stored model (R-22); tie-breaker only. */
export const UNKNOWN_MODEL_SORT_LABEL = 'Unknown model';

/**
 * Precision of `cost_delta_usd`: 1e-4 USD, the smallest step the house cost
 * format prints (`formatCostUsd` shows "<$0.0001" below it). A float difference
 * of equal periods (0.1 + 0.2 vs 0.3) is therefore exactly 0, never a signed
 * "<$0.0001" (F-11). Four decimals is also the rounding applied.
 */
export const COST_DELTA_STEP_USD = 1e-4;
