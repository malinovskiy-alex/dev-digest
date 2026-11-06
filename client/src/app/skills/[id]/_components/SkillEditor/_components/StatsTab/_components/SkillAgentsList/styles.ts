/** Tailwind class strings for "Agents using this skill" (L08 skill-stats). */
export const cx = {
  panel: "flex min-w-0 flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4",
  title: "m-0 text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]",
  list: "m-0 flex list-none flex-col p-0",
  row: "flex items-center gap-3 border-t border-[var(--border)] py-2.5 first:border-t-0",
  name: "min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[var(--text-primary)]",
  runs: "tnum shrink-0 text-[12px] text-[var(--text-muted)]",
  open: "shrink-0 text-[12.5px] font-semibold text-[var(--accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]",
  emptyTitle: "m-0 text-[13.5px] font-semibold text-[var(--text-primary)]",
  emptyBody: "m-0 text-[12.5px] text-[var(--text-secondary)]",
} as const;
