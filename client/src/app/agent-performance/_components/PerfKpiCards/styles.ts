/** Tailwind class strings for the four KPI cards (L08). */
export const cx = {
  // R-88: the cards wrap onto further rows on a narrow viewport.
  grid: "grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3",
  card: "flex min-w-0 flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4",
  title: "m-0 text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]",
  valueRow: "flex items-end justify-between gap-3",
  value: "tnum text-[26px] font-bold leading-none text-[var(--text-primary)]",
  caption: "text-[11.5px] text-[var(--text-muted)]",
  sub: "text-[12px] text-[var(--text-secondary)]",
  name: "truncate text-[16px] font-bold text-[var(--text-primary)]",
  spark: "shrink-0",
  acceptRow: "flex items-center justify-between gap-3",
} as const;
