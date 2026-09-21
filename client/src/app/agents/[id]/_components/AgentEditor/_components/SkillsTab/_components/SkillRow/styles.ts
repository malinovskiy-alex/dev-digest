import type { CSSProperties } from "react";

/** Co-located styles for SkillRow. */
export const s = {
  row: (enabled: boolean, muted: boolean, dragging: boolean, movable: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    borderRadius: 8,
    border: `1px solid ${enabled ? "var(--border-strong)" : "var(--border)"}`,
    // The checked rows carry the weight; the rest stay legible but recede.
    background: enabled ? "var(--bg-elevated)" : "var(--bg-surface)",
    // A globally disabled skill is dimmed but never hidden (L02 D6).
    opacity: dragging ? 0.4 : muted ? 0.62 : 1,
    cursor: movable ? "grab" : "default",
  }),
  handle: (inert: boolean): CSSProperties => ({
    display: "inline-grid",
    placeItems: "center",
    width: 20,
    height: 20,
    padding: 0,
    flexShrink: 0,
    border: "none",
    background: "transparent",
    // A handle that cannot move anything is dimmed, not hidden: the row still
    // has to look like it will become draggable once its box is checked.
    color: inert ? "var(--border-strong)" : "var(--text-muted)",
    cursor: inert ? "not-allowed" : "grab",
  }),
  name: (enabled: boolean): CSSProperties => ({
    fontSize: 13,
    fontWeight: 600,
    color: enabled ? "var(--text-primary)" : "var(--text-secondary)",
  }),
  spacer: { flex: 1, minWidth: 8 } satisfies CSSProperties,
} as const;
