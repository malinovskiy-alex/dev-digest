import type { CSSProperties } from "react";
import { PANEL_MAX_HEIGHT, PANEL_WIDTH } from "./constants";

/** Co-located styles for the findings popover and the rows inside it. */
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

  // ── one finding inside the panel ──────────────────────────────────────────
  row: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "8px 8px",
    borderRadius: 7,
  } satisfies CSSProperties,
  badgeWrap: { paddingTop: 1, flexShrink: 0 } satisfies CSSProperties,
  main: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  } satisfies CSSProperties,
  findingTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  metaRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 3,
    minWidth: 0,
  } satisfies CSSProperties,
  location: {
    fontSize: 12,
    color: "var(--text-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  rationale: {
    margin: "5px 0 0",
    fontSize: 12,
    lineHeight: 1.45,
    color: "var(--text-muted)",
    // Two lines, then ellipsis — a preview, not the finding.
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  } as CSSProperties,
} as const;
