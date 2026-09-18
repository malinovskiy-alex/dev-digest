/** Panel geometry. Wide enough for "file.ts:120-134" without wrapping. */
export const PANEL_WIDTH = 380;
export const PANEL_MAX_HEIGHT = 380;
/** Gap between the trigger and the panel, and the viewport margin when clamping. */
export const PANEL_GAP = 8;
export const VIEWPORT_MARGIN = 12;

/**
 * A long review would overrun the viewport, and a hover panel you have to
 * scroll is not a preview. Show the worst few and say how many are left.
 */
export const PREVIEW_LIMIT = 6;
