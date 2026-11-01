/** Tailwind class strings for a PR Brief file reference. */
export const cx = {
  wrap: "inline-flex min-w-0 flex-wrap items-center gap-1.5",
  button:
    "mono min-w-0 max-w-full cursor-pointer truncate rounded border-0 bg-transparent p-0 text-left text-[12.5px] text-[var(--accent)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]",
  tag: "shrink-0 rounded border border-[var(--border)] bg-[var(--bg-surface)] px-1.5 py-px text-[11px] text-[var(--text-muted)]",
  notice: "shrink-0 text-[12px] text-[var(--warn)]",
} as const;
