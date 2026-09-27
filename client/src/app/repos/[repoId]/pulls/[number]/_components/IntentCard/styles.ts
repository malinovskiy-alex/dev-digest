/** Tailwind class strings for the PR intent card. Colours come from the design tokens in `@devdigest/ui/styles.css`. */
export const cx = {
  card: "flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-[18px]",
  headerRow: "flex flex-wrap items-center gap-2",
  meta: "text-xs text-[var(--text-muted)]",
  quote:
    "m-0 border-l-2 border-[var(--accent)] pl-3 text-[15px] leading-relaxed text-[var(--text-primary)]",
  hint: "m-0 text-[13px] text-[var(--warn)]",
  columns: "grid grid-cols-1 gap-4 md:grid-cols-2",
  groupLabel: "mb-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]",
  list: "m-0 flex list-disc flex-col gap-1 pl-5 text-[13px] text-[var(--text-secondary)]",
  none: "text-[13px] italic text-[var(--text-muted)]",
  chips: "flex flex-wrap gap-1.5",
  conflicts: "rounded-md border border-[var(--warn)] bg-[var(--warn-bg)] px-3 py-2",
  sources: "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]",
  source: "inline-flex items-center gap-1",
  sourceRef: "mono",
  muted: "text-[var(--text-muted)]",
  stateText: "m-0 text-sm text-[var(--text-secondary)]",
  stateHint: "m-0 text-[13px] text-[var(--text-muted)]",
  skeletons: "flex flex-col gap-2",
} as const;
