/** Tailwind class strings for the tour header. */
export const cx = {
  header: "flex flex-col gap-2",
  top: "flex flex-wrap items-start justify-between gap-3",
  title: "m-0 text-[20px] font-bold text-[var(--text-primary)]",
  accent: "text-[var(--accent)]",
  actions: "flex flex-wrap items-center gap-2",
  meta: "m-0 flex flex-wrap items-center gap-2 text-[13px] text-[var(--text-secondary)]",
  metaLine: "cursor-help",
  lines: "m-0 flex list-none flex-col gap-1 p-0",
  line: "m-0 text-[13px] text-[var(--warn)]",
  link: "ml-1 text-[var(--accent)] underline",
  notice:
    "flex items-center justify-between gap-3 rounded-md border border-[var(--crit)] bg-[var(--crit-bg)] px-3 py-2 text-[13px] text-[var(--crit)]",
  dismiss:
    "cursor-pointer rounded-md border-0 bg-transparent px-2 py-0.5 text-[12px] text-[var(--crit)] underline",
} as const;
