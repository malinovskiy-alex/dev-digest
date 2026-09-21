import type { CSSProperties } from "react";

/** Co-located styles for ConventionCard. */
export const s = {
  /**
   * The accepted/rejected state is carried by the left rail AND by the
   * Accepted/Reject buttons below — never by colour alone, and never by opacity
   * alone: a rejected card stays readable, it just stops looking chosen.
   */
  card: (accepted: boolean): CSSProperties => ({
    display: "flex",
    gap: 16,
    padding: 16,
    borderRadius: 10,
    background: "var(--bg-elevated)",
    borderTop: "1px solid var(--border)",
    borderRight: "1px solid var(--border)",
    borderBottom: "1px solid var(--border)",
    borderLeft: "3px solid " + (accepted ? "var(--ok)" : "var(--border-strong)"),
    opacity: accepted ? 1 : 0.72,
    transition: "opacity .12s, border-color .12s",
  }),
  main: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  ruleRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  } satisfies CSSProperties,
  rule: (accepted: boolean): CSSProperties => ({
    fontSize: 14.5,
    fontWeight: 600,
    fontStyle: "italic",
    lineHeight: 1.4,
    flex: 1,
    minWidth: 0,
    // Longhands only. `textDecoration` is a shorthand over
    // `textDecorationColor`, and React warns (to stderr, while the suite stays
    // green) when a rerender changes one of a shorthand/longhand pair — the
    // trap recorded in client/INSIGHTS.md for `borderColor`.
    textDecorationLine: accepted ? "none" : "line-through",
    textDecorationColor: "var(--text-muted)",
  }),
  evidence: {
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    overflow: "hidden",
  } satisfies CSSProperties,
  evidenceHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 10px",
    borderBottom: "1px solid var(--border)",
  } satisfies CSSProperties,
  evidencePath: {
    fontSize: 12,
    color: "var(--text-muted)",
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  snippet: {
    margin: 0,
    padding: "10px 12px",
    fontSize: 12.5,
    lineHeight: 1.6,
    overflowX: "auto",
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  confidenceRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  } satisfies CSSProperties,
  confidenceLabel: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  confidenceBar: { width: 110 } satisfies CSSProperties,
  confidenceValue: { fontSize: 12, color: "var(--text-secondary)" } satisfies CSSProperties,
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: 170,
    flexShrink: 0,
  } satisfies CSSProperties,
  editForm: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 } satisfies CSSProperties,
  editActions: { display: "flex", gap: 8 } satisfies CSSProperties,
} as const;
