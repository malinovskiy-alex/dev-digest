/** Tailwind class strings for the "On this page" aside. */
export const cx = {
  nav: "flex flex-col gap-1",
  title:
    "m-0 mb-1 text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]",
  list: "m-0 flex list-none flex-col gap-0.5 p-0",
  item:
    "w-full cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 text-left text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
  itemActive:
    "w-full cursor-pointer rounded-md border-0 bg-[var(--accent-bg)] px-2 py-1 text-left text-[13px] font-semibold text-[var(--accent-text)]",
} as const;
