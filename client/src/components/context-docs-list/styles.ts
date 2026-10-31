/** Tailwind class strings for ContextDocsList. */
export const cx = {
  wrap: "flex max-w-[860px] flex-col gap-3",
  // The filter sits OUTSIDE the scroll container, so it never scrolls away (UX-03).
  toolbar: "flex items-center gap-3",
  search: "relative ml-auto flex items-center",
  searchIcon: "pointer-events-none absolute left-[9px] text-[var(--text-muted)]",
  searchInput:
    "w-[220px] rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] py-1.5 pl-[26px] pr-2.5 text-[13px] text-[var(--text-primary)]",
  scroll: "max-h-[calc(100vh-340px)] min-h-[160px] overflow-y-auto pr-1",
  list: "m-0 flex list-none flex-col gap-1.5 p-0",
  empty: "m-0 text-[13px] text-[var(--text-secondary)]",
} as const;
