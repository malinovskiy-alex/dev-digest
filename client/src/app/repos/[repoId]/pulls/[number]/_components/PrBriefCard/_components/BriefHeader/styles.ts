/** Tailwind class strings for the PR Brief header. */
export const cx = {
  header: "flex flex-col gap-2",
  top: "flex items-center gap-2",
  icon: "text-[var(--text-muted)]",
  title: "m-0 text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]",
  right: "ml-auto flex items-center gap-2",
  meta: "flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]",
  trimmed: "text-[var(--warn)] underline decoration-dotted underline-offset-2",
  tipList: "flex flex-col gap-1",
} as const;
