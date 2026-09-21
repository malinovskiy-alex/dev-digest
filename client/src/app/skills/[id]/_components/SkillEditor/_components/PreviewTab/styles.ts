import type { CSSProperties } from "react";

/** Co-located styles for PreviewTab. */
export const s = {
  wrap: { maxWidth: 820 } satisfies CSSProperties,
  description: {
    fontSize: 14,
    color: "var(--text-secondary)",
    lineHeight: 1.5,
    marginBottom: 14,
  } satisfies CSSProperties,
  metaRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 16,
  } satisfies CSSProperties,
  notice: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid var(--warn)",
    background: "var(--warn-bg)",
    color: "var(--text-secondary)",
    fontSize: 13,
    lineHeight: 1.5,
    marginBottom: 18,
  } satisfies CSSProperties,
  noticeIcon: { color: "var(--warn)", flexShrink: 0, marginTop: 2 } satisfies CSSProperties,
  body: {
    padding: "4px 0",
    borderTop: "1px solid var(--border)",
    paddingTop: 18,
  } satisfies CSSProperties,
} as const;
