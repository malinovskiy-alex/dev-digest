/** Tailwind class strings for the Findings widget (L08 skill-stats). */
export const cx = {
  card: "flex min-w-0 flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4",
  header: "flex flex-wrap items-center justify-between gap-2",
  title: "m-0 text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]",
  severityRow: "m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0",
  severityItem: "inline-flex items-center gap-1.5 text-[12.5px] font-semibold",
  severityValue: "tnum font-normal text-[var(--text-secondary)]",
  empty: "m-0 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-6 py-8 text-center text-[13.5px] text-[var(--text-secondary)]",
} as const;
