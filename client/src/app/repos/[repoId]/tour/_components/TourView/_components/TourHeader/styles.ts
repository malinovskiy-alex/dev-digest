/** Tailwind class strings for the tour header (design D-4, D-5, D-6, D-16). */
export const cx = {
  header: "flex flex-col gap-3",
  top: "flex flex-wrap items-center justify-between gap-4",
  title: "m-0 text-[34px] font-bold leading-[1.15] tracking-[-0.02em] text-[var(--text-primary)]",
  accent: "font-mono font-semibold text-[var(--accent)]",
  actions: "flex flex-wrap items-center gap-2.5",
  meta: "m-0 flex flex-wrap items-center gap-2 text-[15px] text-[var(--text-secondary)]",
  metaLine: "cursor-help",
  lines: "m-0 flex list-none flex-col items-start gap-2 p-0",
  // A compact warning notice, icon + text, like the app's other notices.
  line:
    "m-0 inline-flex items-center gap-2 rounded-md border border-[var(--warn)] bg-[var(--warn-bg)] px-3 py-1.5 text-[13px] text-[var(--warn)]",
  lineIcon: "shrink-0",
  link: "ml-1 text-[var(--accent)] underline",
  notice:
    "flex items-center justify-between gap-3 rounded-md border border-[var(--crit)] bg-[var(--crit-bg)] px-3 py-2 text-[13px] text-[var(--crit)]",
  dismiss:
    "cursor-pointer rounded-md border-0 bg-transparent px-2 py-0.5 text-[12px] text-[var(--crit)] underline",
} as const;
