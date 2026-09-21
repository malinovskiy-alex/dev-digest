import type { CSSProperties } from "react";

/** Co-located styles for ConfigTab. */
export const s = {
  wrap: {
    maxWidth: 760,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  } satisfies CSSProperties,
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  } satisfies CSSProperties,
  /** Pushes the destructive action away from Save, so the two are not neighbours. */
  spacer: { flex: 1 } satisfies CSSProperties,
} as const;
