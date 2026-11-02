/** Tailwind class strings for the PR Brief's Review focus list. */
export const cx = {
  section: "flex flex-col gap-2",
  heading: "m-0 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]",
  count:
    "rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-1.5 text-[11px] font-semibold normal-case tracking-normal text-[var(--text-secondary)]",
  list: "m-0 flex list-none flex-col gap-1.5 p-0",
  item: "flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px]",
  dash: "shrink-0 text-[var(--text-muted)]",
  reason: "min-w-0 whitespace-pre-line text-[var(--text-secondary)]",
  empty: "m-0 text-[13px] italic text-[var(--text-muted)]",
} as const;
