export const cx = {
  box: "flex flex-col gap-1.5 rounded-md border border-[var(--warn)] bg-[var(--warn-bg)] px-3 py-2",
  row: "flex flex-wrap items-center gap-2 text-xs",
  badge: "inline-flex items-center gap-1 font-bold uppercase tracking-[0.06em] text-[var(--warn)]",
  reason: "text-[var(--text-secondary)]",
  action: "ml-auto",
  hint: "m-0 text-xs text-[var(--text-muted)]",
} as const;
