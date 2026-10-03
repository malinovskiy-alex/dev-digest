import type { CSSProperties } from "react";

export const s = {
  descriptionBox: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--bg-elevated)",
    padding: 18,
    fontSize: 14,
    color: "var(--text-secondary)",
    whiteSpace: "pre-wrap",
    lineHeight: 1.55,
  } satisfies CSSProperties,
} as const;

/**
 * The PR brief row: Intent on the left, Blast Radius on the right (L04). Until
 * Blast Radius ships, the right column is empty, so Intent keeps its designed
 * half width instead of stretching across the page.
 */
export const briefGridClass = "mb-7 grid grid-cols-1 items-start gap-4 lg:grid-cols-2";
