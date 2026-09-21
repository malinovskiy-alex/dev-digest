import type { CSSProperties } from "react";

/** Co-located styles for ConventionsView. The page header mirrors
    SkillsListView so the two Skills-Lab screens read as one system. */
export const s = {
  page: { padding: "24px 32px 44px", maxWidth: 1240, margin: "0 auto" } satisfies CSSProperties,
  header: { display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 } satisfies CSSProperties,
  headerText: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  h1: { fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" } satisfies CSSProperties,
  repoName: { color: "var(--accent)" } satisfies CSSProperties,
  scanMeta: {
    fontSize: 13,
    color: "var(--text-muted)",
    marginTop: 6,
  } satisfies CSSProperties,
  subtitle: {
    fontSize: 14,
    color: "var(--text-secondary)",
    marginTop: 6,
    maxWidth: 620,
    lineHeight: 1.45,
  } satisfies CSSProperties,
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  } satisfies CSSProperties,
  toolbarCount: { fontSize: 13, color: "var(--text-muted)", flex: 1 } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 14 } satisfies CSSProperties,
} as const;
