import type { CSSProperties } from "react";

/** Co-located styles for RunFindingsChips. */
export const s = {
  // A button for keyboard reach, styled as the plain chips it wraps: on the
  // timeline the tally is the content, and the preview is the affordance.
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
} as const;
