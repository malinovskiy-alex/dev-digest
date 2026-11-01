/** Tailwind class strings for the run-locally section. */
export const cx = {
  list: "m-0 flex list-none flex-col gap-2 p-0",
  row: "flex flex-wrap items-center gap-2 text-[13px]",
  step: "min-w-[1.5em] text-right font-mono text-[12px] text-[var(--text-muted)]",
  command:
    "rounded bg-[var(--code-bg)] px-2 py-1 font-mono text-[12px] text-[var(--text-primary)] break-all",
  comment: "min-w-0 flex-1 text-[var(--text-secondary)]",
  gap: "m-0 text-[13px] text-[var(--text-secondary)]",
} as const;
