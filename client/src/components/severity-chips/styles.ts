import type { CSSProperties } from "react";

/** Co-located styles for SeverityChips. Colours always come from SEV tokens. */
export const s = {
  row: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  separator: {
    color: "var(--text-muted)",
    fontSize: 12,
    userSelect: "none",
  } satisfies CSSProperties,
  /**
   * The interactive pill. Dimmed when a *different* pill is active, so the
   * filtered-down state reads at a glance without hiding the other buckets
   * (hiding them would make the filter impossible to switch).
   */
  pill: (color: string, bg: string, dimmed: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 9px",
    borderRadius: 5,
    // All-longhand: React warns when a `border` shorthand and a longhand are
    // updated on the same rerender.
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "transparent",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "inherit",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color,
    background: bg,
    opacity: dimmed ? 0.45 : 1,
    cursor: "pointer",
    transition: "opacity .12s",
  }),
  pillActiveRing: (color: string): CSSProperties => ({ borderColor: color }),
  readOnlyChip: { display: "inline-flex" } satisfies CSSProperties,
} as const;
