/** Tailwind class strings for a tour file row (design D-12, D-14). */
export const cx = {
  // Critical paths: an inner card on the darker surface.
  card: "flex items-center gap-3 rounded-lg bg-[var(--bg-surface)] px-4 py-3",
  fileIcon: "shrink-0 text-[var(--text-muted)]",
  text: "flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5",
  path: "break-all font-mono text-[13.5px] text-[var(--text-primary)]",
  reason: "text-[14px] text-[var(--text-secondary)]",
  open:
    "shrink-0 rounded-md border border-[var(--border-strong)] bg-transparent px-3 py-1 text-[13px] font-medium text-[var(--text-primary)] no-underline hover:bg-[var(--bg-hover)]",
  // Reading path: number badge, path, then the why on its own line.
  numbered: "flex items-start gap-3",
  badge:
    "inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-bg)] px-1 font-mono text-[12px] font-semibold text-[var(--accent)]",
  lines: "flex min-w-0 flex-1 flex-col gap-1 pt-[3px]",
  why: "text-[14px] text-[var(--text-secondary)]",
  openQuiet:
    "shrink-0 rounded-md px-2 py-1 text-[12.5px] text-[var(--text-muted)] no-underline hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
} as const;
