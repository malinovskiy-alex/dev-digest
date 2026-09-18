import type { CSSProperties } from "react";

/** Co-located styles for FindingPreview. */
export const s = {
  row: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "8px 8px",
    borderRadius: 7,
  } satisfies CSSProperties,
  badgeWrap: { paddingTop: 1, flexShrink: 0 } satisfies CSSProperties,
  main: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  } satisfies CSSProperties,
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  metaRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 3,
    minWidth: 0,
  } satisfies CSSProperties,
  location: {
    fontSize: 12,
    color: "var(--text-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  rationale: {
    margin: "5px 0 0",
    fontSize: 12,
    lineHeight: 1.45,
    color: "var(--text-muted)",
    // Two lines, then ellipsis — a preview, not the finding.
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  } as CSSProperties,
} as const;
