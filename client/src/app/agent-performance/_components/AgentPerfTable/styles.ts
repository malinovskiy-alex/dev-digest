/** Tailwind class strings for the agents table (L08). */
export const cx = {
  // R-88: the table scrolls sideways on a narrow viewport; no column is hidden.
  scroll: "overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]",
  table: "w-full min-w-[860px] border-collapse text-[13px]",
  th: "px-3 py-2 text-left align-bottom text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)] border-b border-[var(--border)]",
  sortBtn:
    "inline-flex flex-col items-start gap-0.5 bg-transparent border-0 p-0 text-inherit font-inherit uppercase tracking-inherit cursor-pointer hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]",
  sortLine: "inline-flex items-center gap-1",
  subLabel: "normal-case tracking-normal font-normal text-[10.5px] text-[var(--text-muted)]",
} as const;
