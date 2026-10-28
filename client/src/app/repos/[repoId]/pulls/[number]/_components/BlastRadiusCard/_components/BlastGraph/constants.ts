/* Geometry of the hand-laid-out blast graph (D12). SVG user units on a fixed
   viewBox; the SVG scales to the card width. None of these is a repo-intel
   limit — those live in server/src/modules/repo-intel/constants.ts. */

/** viewBox width. */
export const VIEW_W = 720;

/** Left edge of each column: changed symbol → caller → endpoint / cron. */
export const COL_X = [8, 262, 516] as const;

/** Node box width — leaves a 58-unit gutter between columns for the edges. */
export const NODE_W = 196;

/** Node box height. */
export const NODE_H = 26;

/** Vertical distance between the tops of two rows. */
export const ROW_GAP = 36;

/** Top/bottom padding inside the viewBox. */
export const PAD = 10;

/** Rows per column before the rest fold into one "+N more" node — keeps the picture readable. */
export const GRAPH_MAX_ROWS = 12;

/** Characters of a label that fit in NODE_W at the mono font size; longer ones get "…". */
export const LABEL_MAX = 26;
