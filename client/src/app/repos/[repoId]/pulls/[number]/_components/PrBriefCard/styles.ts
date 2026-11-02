/** Tailwind class strings for the PR Brief block. Colours come from the design tokens in `@devdigest/ui/styles.css`. */
export const cx = {
  card: "mb-4 flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-[18px]",
  skeletons: "flex flex-col gap-2",
  groups: "flex flex-col gap-4",
  group: "flex flex-col gap-2",
  groupLabel: "text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]",
  errorBox: "flex flex-col gap-2 text-sm text-[var(--crit)]",
  stateText: "m-0 text-sm text-[var(--text-secondary)]",
  hint: "m-0 text-[13px] text-[var(--text-muted)]",
  empty: "flex flex-col gap-2",
  keyLine:
    "m-0 inline-flex flex-wrap items-center gap-1 self-start rounded-md border border-[var(--warn)] bg-[var(--warn-bg)] px-3 py-1.5 text-[13px] text-[var(--warn)]",
  link: "text-[var(--accent)] underline",
  failure: "m-0 text-[13px] text-[var(--crit)]",
  notice:
    "flex items-center justify-between gap-3 rounded-md border border-[var(--crit)] bg-[var(--crit-bg)] px-3 py-2 text-[13px] text-[var(--crit)]",
  dismiss:
    "cursor-pointer rounded-md border-0 bg-transparent px-2 py-0.5 text-[12px] text-[var(--crit)] underline",
  missing: "m-0 text-[13px] text-[var(--warn)]",
  body: "flex flex-col gap-4",
  /** Model text: plain text with its line breaks kept (D-28). */
  summary: "m-0 whitespace-pre-line text-[14px] leading-relaxed text-[var(--text-primary)]",
} as const;
