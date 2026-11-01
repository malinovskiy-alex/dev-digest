/** Constants for the PR Overview tab (L05 PR Brief navigation). */

/** How long "File not in this PR's diff" stays next to the activated item (R-56, D-30). */
export const NOT_IN_DIFF_MS = 4000;

/** sessionStorage key prefix of the Overview scroll position saved before a focus navigation (R-77, D-32). */
export const OVERVIEW_SCROLL_KEY_PREFIX = "pr-overview-scroll:";

/** Longest wait for the Overview's queries to settle before the scroll is restored anyway (D-32). */
export const RESTORE_MAX_WAIT_MS = 3000;
