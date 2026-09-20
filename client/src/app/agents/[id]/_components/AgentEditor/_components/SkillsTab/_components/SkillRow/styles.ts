import type { CSSProperties } from "react";

/** Co-located styles for SkillRow. */
export const s = {
  row: (attached: boolean, muted: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 8,
    border: `1px solid ${attached ? "var(--border-strong)" : "var(--border)"}`,
    background: attached ? "var(--bg-elevated)" : "var(--bg-surface)",
    // A globally disabled skill is dimmed but never hidden (L02 D6).
    opacity: muted ? 0.62 : 1,
  }),
  position: {
    width: 22,
    flexShrink: 0,
    paddingTop: 2,
    fontSize: 12,
    fontWeight: 700,
    textAlign: "right",
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  main: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  nameRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 3 } satisfies CSSProperties,
  name: { fontSize: 14, fontWeight: 600, color: "var(--text-primary)" } satisfies CSSProperties,
  description: { fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.45 } satisfies CSSProperties,
  disabledNote: {
    marginTop: 5,
    fontSize: 12,
    color: "var(--warn, var(--text-muted))",
    lineHeight: 1.45,
  } satisfies CSSProperties,
  reorder: { display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 } satisfies CSSProperties,
  moveBtn: (disabled: boolean): CSSProperties => ({
    display: "inline-grid",
    placeItems: "center",
    width: 24,
    height: 20,
    padding: 0,
    borderRadius: 4,
    border: "1px solid var(--border)",
    background: "transparent",
    color: disabled ? "var(--border-strong)" : "var(--text-secondary)",
    cursor: disabled ? "not-allowed" : "pointer",
  }),
  toggleLabel: (busy: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    flexShrink: 0,
    paddingTop: 2,
    cursor: busy ? "wait" : "pointer",
    opacity: busy ? 0.5 : 1,
  }),
  /** Names the toggle for assistive tech without adding visual noise. */
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    margin: -1,
    padding: 0,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
    border: 0,
  } satisfies CSSProperties,
} as const;
