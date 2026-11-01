/** Tailwind class strings for the run-locally section (design D-13). */
export const cx = {
  list: "m-0 flex list-none flex-col gap-2.5 p-0",
  row:
    "flex items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--code-bg)] py-2 pl-4 pr-2",
  step: "w-5 shrink-0 font-mono text-[12px] text-[var(--text-muted)]",
  line: "flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 font-mono text-[14px]",
  command: "break-all font-mono text-[var(--text-primary)]",
  comment: "text-[var(--text-muted)]",
  // A `backtick` span inside a comment: a touch brighter than the comment.
  commentCode: "font-mono text-[var(--text-secondary)]",
  gap: "m-0 text-[14px] text-[var(--text-secondary)]",
} as const;
