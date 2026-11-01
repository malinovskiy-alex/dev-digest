/** Tailwind class strings for the copy control. */
export const cx = {
  wrap: "inline-flex flex-wrap items-center gap-2",
  button:
    "inline-flex cursor-pointer items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
  copied: "text-[12px] text-[var(--ok)]",
  manual: "inline-flex items-center gap-2 text-[12px] text-[var(--text-secondary)]",
  input:
    "min-w-[240px] rounded-md border border-[var(--border)] bg-[var(--code-bg)] px-2 py-1 font-mono text-[12px] text-[var(--text-primary)]",
} as const;
