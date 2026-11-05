/** Tailwind class strings for the skill Stats KPI cards (L08 skill-stats). */
export const cx = {
  /** Wraps onto as many rows as the width needs, hiding no value (R-54). */
  grid: "grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3",
  card: "flex min-w-0 flex-col gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4",
  title: "m-0 text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]",
  value: "tnum text-[26px] font-bold leading-none text-[var(--text-primary)]",
  sub: "tnum text-[12px] text-[var(--text-muted)]",
} as const;
