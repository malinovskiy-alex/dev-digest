/** Tailwind class strings for the Cost breakdown section (L08). */
export const cx = {
  section: "flex flex-col gap-3",
  heading: "m-0 text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]",
  grid: "grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-3",
  card: "flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4",
  cardTitle: "m-0 text-[13px] font-semibold text-[var(--text-primary)]",
  empty: "m-0 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-center text-[13px] text-[var(--text-secondary)]",
} as const;
