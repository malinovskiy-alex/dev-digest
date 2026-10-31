/** Tailwind class strings for the Project Context page. Same tokens as BlastRadiusCard/styles.ts. */
export const cx = {
  page: "flex flex-col gap-4",
  header: "flex flex-col gap-1",
  title: "m-0 text-[20px] font-bold text-[var(--text-primary)]",
  subtitle: "m-0 text-[13px] leading-relaxed text-[var(--text-secondary)]",
  layout: "grid grid-cols-[minmax(240px,320px)_1fr] gap-4 items-start",
  // The tree panel has a fixed height; its header and footer stay put and only
  // the tree in the middle scrolls (UX-03).
  treePanel:
    "flex h-[calc(100vh-200px)] min-h-[360px] flex-col rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]",
  treeHeader:
    "flex items-center gap-2 border-0 border-b border-solid border-[var(--border)] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]",
  treeScroll: "flex-1 overflow-y-auto px-2 py-2",
  capped:
    "mx-3 mt-2 rounded-md border border-[var(--warn)] px-2 py-1.5 text-[12px] text-[var(--warn)]",
  viewerPanel:
    "min-h-[360px] rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-[18px]",
  skeletons: "flex flex-col gap-2 p-2",
  selectPrompt: "m-0 text-[13px] text-[var(--text-secondary)]",
} as const;
