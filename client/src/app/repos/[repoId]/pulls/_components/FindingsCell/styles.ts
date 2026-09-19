import type { CSSProperties } from "react";

/** Co-located styles for FindingsCell. */
export const s = {
  cell: { display: "flex", alignItems: "center", minWidth: 0 } satisfies CSSProperties,
  // A button for keyboard reach, styled as the plain chips it wraps. The
  // pointer cursor appears only when there is something to preview — chips
  // reading `—` are not a control.
  trigger: (canPreview: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: 0,
    border: "none",
    background: "none",
    font: "inherit",
    color: "inherit",
    cursor: canPreview ? "pointer" : "default",
  }),
  muted: { color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
