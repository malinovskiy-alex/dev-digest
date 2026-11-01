/** Tailwind class strings for the "On this page" column (design D-1, D-2). */
export const cx = {
  nav: "flex flex-col",
  title:
    "m-0 mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]",
  // A thin rule down the list's left edge; the current item lays an accent
  // segment over it (`-ml-px` puts the item's border on the rule).
  list: "m-0 flex list-none flex-col border-l border-[var(--border)] p-0",
  item:
    "-ml-px w-full cursor-pointer border-l-2 border-transparent bg-transparent py-1.5 pl-4 pr-2 text-left text-[14px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
  itemActive:
    "-ml-px w-full cursor-pointer border-l-2 border-[var(--accent)] bg-transparent py-1.5 pl-4 pr-2 text-left text-[14px] font-medium text-[var(--text-primary)]",
} as const;
