const chip =
  "inline-flex max-w-full items-center gap-1.5 rounded-md border bg-[var(--bg-surface)] px-2 py-1 text-xs";

export const cx = {
  node: "rounded-md border border-[var(--border)] bg-[var(--bg-surface)]",
  toggle:
    "flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-2 text-left text-[13px] text-[var(--text-primary)]",
  muted: "shrink-0 text-[var(--text-muted)]",
  symbolIcon: "shrink-0 text-[var(--accent)]",
  symbol: "mono truncate font-semibold",
  count: "ml-auto shrink-0 text-xs text-[var(--text-muted)]",
  panel: "flex flex-col gap-3 border-0 border-t border-solid border-[var(--border)] px-3 py-2.5",
  callers: "m-0 flex list-none flex-col gap-1.5 p-0",
  caller: "flex items-center gap-2 text-xs",
  link: "mono truncate text-[var(--accent)] no-underline hover:underline",
  location: "mono truncate text-[var(--text-secondary)]",
  callerName: "mono ml-auto shrink-0 text-[var(--text-muted)]",
  groupLabel: "mb-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]",
  chips: "m-0 flex list-none flex-wrap gap-2 p-0",
  endpointChip: `${chip} border-[var(--accent)] text-[var(--accent)]`,
  cronChip: `${chip} border-[var(--warn)] text-[var(--warn)]`,
  chipText: "mono truncate",
} as const;
