/** Constants for the Files changed tab. */

/** The two orders the diff can be shown in: grouped by role, or GitHub's. */
export const DIFF_ORDERS = ["smart", "original"] as const;
export type DiffOrder = (typeof DIFF_ORDERS)[number];

/** The tab opens in Smart order; the choice is local state, never persisted. */
export const DEFAULT_DIFF_ORDER: DiffOrder = "smart";
