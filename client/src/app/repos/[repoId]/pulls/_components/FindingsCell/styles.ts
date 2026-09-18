import type { CSSProperties } from "react";

/** Co-located styles for FindingsCell. */
export const s = {
  cell: { display: "flex", alignItems: "center", minWidth: 0 } satisfies CSSProperties,
  // A button for keyboard reach, styled as the plain chips it wraps: the
  // affordance here is the hover, not a pressable control.
  trigger: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: 0,
    border: "none",
    background: "none",
    font: "inherit",
    color: "inherit",
    cursor: "default",
  } satisfies CSSProperties,
  muted: { color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
