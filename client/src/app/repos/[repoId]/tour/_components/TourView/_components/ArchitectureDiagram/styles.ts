/** Tailwind class strings for the architecture diagram (design D-10). */
export const cx = {
  // A darker inset panel; the drawing scrolls sideways when wide.
  wrap: "overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--code-bg)] p-8",
  // `mx-auto` centres a narrow drawing; a wide one scrolls from its left edge.
  svg: "mx-auto block",
  label: "fill-[var(--text-primary)] font-mono text-[12px]",
  edge: "stroke-[var(--text-muted)]",
  arrow: "fill-[var(--text-muted)]",
  srOnly: "sr-only",
} as const;
