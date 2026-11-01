/** Tailwind class strings for the copy control. */
export const cx = {
  wrap: "inline-flex flex-wrap items-center gap-2",
  // Same box as the `@devdigest/ui` secondary Button at size "lg" (design D-6).
  button:
    "inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-[18px] py-[10px] text-[14px] font-medium leading-[1.2] tracking-[-0.01em] text-[var(--text-primary)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-hover)]",
  iconButton:
    "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
  copied: "text-[12px] text-[var(--ok)]",
  manual: "inline-flex items-center gap-2 text-[12px] text-[var(--text-secondary)]",
  input:
    "min-w-[240px] rounded-md border border-[var(--border)] bg-[var(--code-bg)] px-2 py-1 font-mono text-[12px] text-[var(--text-primary)]",
} as const;
