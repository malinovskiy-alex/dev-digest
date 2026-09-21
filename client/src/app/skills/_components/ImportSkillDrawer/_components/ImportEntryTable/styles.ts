import type { CSSProperties } from "react";

/** Co-located styles for ImportEntryTable. */
export const s = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 12.5,
    border: "1px solid var(--border)",
    borderRadius: 8,
    overflow: "hidden",
  } satisfies CSSProperties,
  caption: {
    captionSide: "top",
    textAlign: "left",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    paddingBottom: 10,
  } satisfies CSSProperties,
  th: {
    textAlign: "left",
    fontWeight: 600,
    color: "var(--text-muted)",
    padding: "8px 12px",
    background: "var(--bg-surface)",
    borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  thNumeric: {
    textAlign: "right",
    fontWeight: 600,
    color: "var(--text-muted)",
    padding: "8px 12px",
    background: "var(--bg-surface)",
    borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  row: (muted: boolean): CSSProperties => ({
    borderBottom: "1px solid var(--border)",
    color: muted ? "var(--text-muted)" : "var(--text-secondary)",
    background: muted ? "var(--bg-surface)" : "transparent",
  }),
  td: { padding: "7px 12px" } satisfies CSSProperties,
  tdNumeric: { padding: "7px 12px", textAlign: "right", whiteSpace: "nowrap" } satisfies CSSProperties,
  path: { display: "inline-flex", alignItems: "center", gap: 7 } satisfies CSSProperties,
  lock: { color: "var(--warn)", flexShrink: 0 } satisfies CSSProperties,
  notProcessed: { color: "var(--text-muted)", fontStyle: "italic" } satisfies CSSProperties,
  kindCell: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } satisfies CSSProperties,
} as const;
