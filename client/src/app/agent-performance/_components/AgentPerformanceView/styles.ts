/** Tailwind class strings for the Agent Performance screen (L08). */
export const cx = {
  page: "mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-7 py-6",
  header: "flex flex-wrap items-start justify-between gap-4",
  controls: "flex flex-col items-end gap-1",
  title: "m-0 text-[22px] font-bold text-[var(--text-primary)]",
  subtitle: "m-0 mt-1 text-[13.5px] text-[var(--text-secondary)]",
  body: "flex flex-col gap-5",
  kpiGrid: "grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3",
  kpiSkeleton: "flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4",
  tableSkeleton: "flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4",
  chartGrid: "grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-3",
  empty:
    "flex flex-col items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-6 py-12 text-center",
  emptyTitle: "m-0 text-[16px] font-bold text-[var(--text-primary)]",
  emptyBody: "m-0 text-[13.5px] text-[var(--text-secondary)]",
  emptyLink: "mt-2 text-[13px] font-semibold text-[var(--accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]",
} as const;
