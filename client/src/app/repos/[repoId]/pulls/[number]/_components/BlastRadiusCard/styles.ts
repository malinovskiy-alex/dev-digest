/** Tailwind class strings for the Blast Radius card. Same tokens as IntentCard/styles.ts. */
export const cx = {
  card: "flex h-full flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-[18px]",
  header: "flex items-center gap-2",
  headerIcon: "text-[var(--text-muted)]",
  headerLabel: "text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]",
  statsRow: "flex flex-wrap items-center gap-x-4 gap-y-2",
  stats: "m-0 flex flex-wrap items-center gap-x-4 gap-y-1 p-0 text-[13px] text-[var(--text-secondary)]",
  stat: "inline-flex items-center gap-1.5",
  statIcon: "text-[var(--text-muted)]",
  statNum: "font-bold text-[var(--text-primary)]",
  toggleSlot: "ml-auto",
  tree: "m-0 flex list-none flex-col gap-2 p-0",
  skeletons: "flex flex-col gap-2",
  stateText: "m-0 text-[13px] text-[var(--text-secondary)]",
  errorBox: "flex flex-col gap-2 text-sm text-[var(--crit)]",
  divider: "m-0 border-0 border-t border-solid border-[var(--border)]",
} as const;
