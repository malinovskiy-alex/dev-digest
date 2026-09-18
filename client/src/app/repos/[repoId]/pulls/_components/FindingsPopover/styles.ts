import type { CSSProperties } from "react";
import { PANEL_MAX_HEIGHT, PANEL_WIDTH } from "./constants";

/** Co-located styles for FindingsPopover. */
export const s = {
  /**
   * Same overlay family as vendor/ui/kit/Dropdown — elevated surface, strong
   * border, modal shadow, ddpop. Positioning comes from `panelPosition`; see
   * the note there about why this is fixed rather than absolute.
   */
  panel: (pos: { top?: number; bottom?: number; left: number }): CSSProperties => ({
    position: "fixed",
    top: pos.top,
    bottom: pos.bottom,
    left: pos.left,
    width: PANEL_WIDTH,
    maxHeight: PANEL_MAX_HEIGHT,
    overflowY: "auto",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-strong)",
    borderRadius: 9,
    boxShadow: "var(--shadow-modal)",
    padding: 8,
    zIndex: 40,
    animation: "ddpop .12s ease",
    cursor: "default",
  }),
  title: {
    padding: "4px 8px 8px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  state: {
    padding: "10px 8px",
    fontSize: 12.5,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  more: {
    padding: "6px 8px 2px",
    fontSize: 12,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  divider: { height: 1, background: "var(--border)", margin: "2px 6px" } satisfies CSSProperties,
} as const;
