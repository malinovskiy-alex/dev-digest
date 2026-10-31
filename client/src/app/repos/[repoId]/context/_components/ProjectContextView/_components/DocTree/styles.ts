/** Tailwind class strings for DocTree. */
const ROW =
  "flex w-full items-center gap-1.5 rounded-md border-0 bg-transparent py-1 pr-2 text-left text-[13px] cursor-pointer hover:bg-[var(--bg-hover)]";

export const cx = {
  list: "m-0 flex list-none flex-col p-0",
  folder: `${ROW} font-semibold text-[var(--text-secondary)]`,
  leaf: (selected: boolean) =>
    `${ROW} ${selected ? "bg-[var(--accent-bg)] text-[var(--accent-text)]" : "text-[var(--text-primary)]"}`,
  leafIcon: "shrink-0 text-[var(--text-muted)]",
  leafName: "min-w-0 flex-1 truncate font-mono",
  tag: "shrink-0 rounded px-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)] bg-[var(--bg-surface)]",
} as const;
