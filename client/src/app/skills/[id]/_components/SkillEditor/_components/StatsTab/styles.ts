/** Tailwind class strings for the skill Stats tab (L08 skill-stats). */
export const cx = {
  wrap: "flex max-w-[1040px] flex-col gap-4",
  header: "flex flex-wrap items-start justify-between gap-3",
  h2: "m-0 text-[18px] font-bold text-[var(--text-primary)]",
  controls: "flex flex-col items-end gap-1",
  note: "m-0 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-[12.5px] text-[var(--text-secondary)]",
  offNote: "m-0 rounded-md border border-[var(--warn)] bg-[var(--warn-bg)] px-3 py-2 text-[12.5px] font-semibold text-[var(--warn)]",
  /** List and widget side by side on a wide screen, one under the other otherwise (R-54). */
  columns: "grid grid-cols-1 gap-3 lg:grid-cols-2",
  kpiGrid: "grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3",
  /** The skeleton joins the tab's column layout as if its children were the tab's own. */
  skeleton: "contents",
  panel: "flex min-w-0 flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4",
} as const;
