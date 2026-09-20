import type { CSSProperties } from "react";

/** Co-located styles for SkillPreview (the right-hand rail of /skills). */
export const s = {
  wrap: { padding: 16 } satisfies CSSProperties,
  header: { display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 } satisfies CSSProperties,
  headerText: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  name: { fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", wordBreak: "break-word" } satisfies CSSProperties,
  description: { fontSize: 13, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.45 } satisfies CSSProperties,
  metaRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 } satisfies CSSProperties,
  notice: {
    display: "flex",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 7,
    border: "1px solid var(--warn)",
    background: "var(--warn-bg)",
    color: "var(--text-secondary)",
    fontSize: 12.5,
    lineHeight: 1.5,
    marginBottom: 14,
  } satisfies CSSProperties,
  noticeIcon: { color: "var(--warn)", flexShrink: 0, marginTop: 2 } satisfies CSSProperties,
  body: {
    fontSize: 13,
    color: "var(--text-secondary)",
    borderTop: "1px solid var(--border)",
    paddingTop: 14,
  } satisfies CSSProperties,
  actions: { display: "flex", gap: 10, marginTop: 4 } satisfies CSSProperties,
  loading: { display: "grid", gap: 10, padding: 16 } satisfies CSSProperties,
} as const;
