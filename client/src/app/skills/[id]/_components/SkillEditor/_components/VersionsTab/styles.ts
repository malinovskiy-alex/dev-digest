import type { CSSProperties } from "react";
import type { DiffLine } from "./helpers";

/** Co-located styles for VersionsTab. */
export const s = {
  wrap: { maxWidth: 820 } satisfies CSSProperties,
  skeletons: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    maxWidth: 820,
  } satisfies CSSProperties,
  count: { fontSize: 13, color: "var(--text-secondary)" } satisfies CSSProperties,
  hint: {
    fontSize: 13,
    color: "var(--text-muted)",
    lineHeight: 1.5,
    margin: "6px 0 20px",
  } satisfies CSSProperties,
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  } satisfies CSSProperties,
  row: (current: boolean): CSSProperties => ({
    padding: "10px 14px",
    borderRadius: 8,
    border: `1px solid ${current ? "var(--border-strong)" : "var(--border)"}`,
    background: current ? "var(--bg-elevated)" : "var(--bg-surface)",
  }),
  rowMain: { display: "flex", alignItems: "center", gap: 12 } satisfies CSSProperties,
  version: {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--text-primary)",
    flexShrink: 0,
  } satisfies CSSProperties,
  summary: (empty: boolean): CSSProperties => ({
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    color: empty ? "var(--text-muted)" : "var(--text-secondary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  }),
  date: { fontSize: 12, color: "var(--text-muted)", flexShrink: 0 } satisfies CSSProperties,
  diff: {
    margin: "10px 0 2px",
    padding: 12,
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-primary)",
    fontSize: 12,
    lineHeight: 1.55,
    // A body is arbitrary text: wrap it rather than letting one long line
    // stretch the panel and give the whole page a horizontal scrollbar.
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    maxHeight: 420,
    overflow: "auto",
  } satisfies CSSProperties,
  /** Colour alone would fail WCAG here, so every line also carries +/-/space. */
  diffLine: (kind: DiffLine["kind"]): CSSProperties => ({
    display: "block",
    color:
      kind === "add"
        ? "var(--ok)"
        : kind === "remove"
          ? "var(--crit)"
          : "var(--text-muted)",
    background:
      kind === "add"
        ? "var(--ok-bg, transparent)"
        : kind === "remove"
          ? "var(--crit-bg, transparent)"
          : "transparent",
  }),
} as const;
