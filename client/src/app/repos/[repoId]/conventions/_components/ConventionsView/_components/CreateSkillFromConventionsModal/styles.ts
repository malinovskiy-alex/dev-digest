import type { CSSProperties } from "react";

/** Co-located styles for CreateSkillFromConventionsModal. */
export const s = {
  body: { padding: 24 } satisfies CSSProperties,
  notice: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 8,
    background: "var(--accent-bg)",
    color: "var(--text-secondary)",
    fontSize: 13,
    lineHeight: 1.5,
    marginBottom: 20,
  } satisfies CSSProperties,
  noticeIcon: { color: "var(--accent)", flexShrink: 0, marginTop: 2 } satisfies CSSProperties,
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 } satisfies CSSProperties,
  toggleRow: { display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  fileBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    border: "1px solid var(--border-strong)",
    borderBottom: "none",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  fileName: { fontSize: 12.5, fontWeight: 600 } satisfies CSSProperties,
  tokens: { marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  footer: { display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  footerNote: { flex: 1, fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  loading: { padding: 24 } satisfies CSSProperties,
} as const;
