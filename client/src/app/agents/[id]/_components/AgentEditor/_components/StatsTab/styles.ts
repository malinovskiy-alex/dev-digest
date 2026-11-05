/** Tailwind class strings for the agent Stats tab (L08). */
export const cx = {
  wrap: "flex max-w-[1040px] flex-col gap-4",
  header: "flex flex-wrap items-start justify-between gap-3",
  h2: "m-0 text-[18px] font-bold text-[var(--text-primary)]",
  grid: "grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3",
  tile: "flex min-w-0 flex-col gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4",
  tileTitle: "m-0 text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]",
  value: "tnum text-[22px] font-bold leading-none text-[var(--text-primary)]",
  caption: "text-[11.5px] text-[var(--text-muted)]",
  sub: "text-[12px] text-[var(--text-secondary)]",
  empty: "m-0 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-6 py-10 text-center text-[14px] font-semibold text-[var(--text-primary)]",
} as const;
