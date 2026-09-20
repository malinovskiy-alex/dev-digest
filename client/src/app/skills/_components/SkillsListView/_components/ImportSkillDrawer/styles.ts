import type { CSSProperties } from "react";

/** Co-located styles for ImportSkillDrawer. */
export const s = {
  section: { marginBottom: 18 } satisfies CSSProperties,
  hint: { fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 8 } satisfies CSSProperties,
  picked: { fontSize: 13, color: "var(--text-secondary)", marginTop: 10 } satisfies CSSProperties,
  fileInput: { fontSize: 13, color: "var(--text-secondary)" } satisfies CSSProperties,
  error: {
    display: "flex",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 7,
    border: "1px solid var(--crit)",
    background: "var(--crit-bg)",
    color: "var(--text-primary)",
    fontSize: 13,
    lineHeight: 1.5,
    marginBottom: 16,
  } satisfies CSSProperties,
  errorIcon: { color: "var(--crit)", flexShrink: 0, marginTop: 2 } satisfies CSSProperties,
  warnings: {
    margin: 0,
    paddingLeft: 18,
    fontSize: 12.5,
    color: "var(--text-secondary)",
    lineHeight: 1.6,
  } satisfies CSSProperties,
  footer: { display: "flex", justifyContent: "flex-end", gap: 10 } satisfies CSSProperties,
} as const;
