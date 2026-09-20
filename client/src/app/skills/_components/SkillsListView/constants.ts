/** Constants for the Skills list view. */

/**
 * Card grid template. Narrower than the agents grid (280px) because the preview
 * rail takes the right-hand third of the page.
 */
export const CARD_GRID_COLS = "repeat(auto-fill, minmax(240px, 1fr))";

/** Grid + preview rail. The rail is fixed-width so the cards reflow, not it. */
export const SPLIT_COLS = "minmax(0, 1fr) minmax(0, 400px)";

/** How many skeleton cards stand in for the grid while it loads. */
export const SKELETON_COUNT = 3;
