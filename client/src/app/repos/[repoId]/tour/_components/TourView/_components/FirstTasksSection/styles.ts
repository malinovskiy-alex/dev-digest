/** Tailwind class strings for the first-tasks section (design D-15). */
export const cx = {
  list: "m-0 flex list-none flex-col gap-2.5 p-0",
  task: "flex items-center gap-3 rounded-lg bg-[var(--bg-surface)] px-4 py-3",
  body: "flex min-w-0 flex-1 flex-col gap-1",
  head: "flex flex-wrap items-center gap-2",
  title: "text-[14px] font-semibold text-[var(--text-primary)]",
  reason: "m-0 text-[14px] text-[var(--text-secondary)]",
  link:
    "shrink-0 rounded-md border border-[var(--border-strong)] bg-transparent px-3 py-1 text-[13px] font-medium text-[var(--text-primary)] no-underline hover:bg-[var(--bg-hover)]",
  gap: "m-0 text-[14px] text-[var(--text-secondary)]",
} as const;
