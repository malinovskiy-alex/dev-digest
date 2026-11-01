/** Tailwind class strings for a tour file row. */
export const cx = {
  row: "flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] text-[var(--text-secondary)]",
  index: "min-w-[1.5em] text-right font-mono text-[12px] text-[var(--text-muted)]",
  path: "rounded bg-[var(--code-bg)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--text-primary)]",
  reason: "min-w-0 flex-1",
  open: "text-[12px] text-[var(--accent)] underline",
} as const;
