const base =
  "cursor-pointer border-0 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors";

export const cx = {
  group: "inline-flex overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-surface)]",
  button: `${base} bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]`,
  active: `${base} bg-[var(--bg-elevated)] text-[var(--text-primary)]`,
} as const;
