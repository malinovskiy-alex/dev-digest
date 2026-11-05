/** Tailwind class strings for the range control (L08). */
export const cx = {
  wrap: "flex flex-col items-end gap-2",
  group: "inline-flex overflow-hidden rounded-md border border-[var(--border)]",
  choice:
    "px-3 py-1.5 text-[12.5px] font-semibold text-[var(--text-secondary)] bg-transparent border-0 cursor-pointer hover:bg-[var(--bg-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] aria-pressed:bg-[var(--bg-hover)] aria-pressed:text-[var(--text-primary)]",
  custom: "flex flex-wrap items-end gap-2",
  field: "flex flex-col gap-1 text-[11.5px] text-[var(--text-muted)]",
  input:
    "rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-1 text-[12.5px] text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]",
  error: "text-[12px] text-[var(--crit)]",
} as const;
