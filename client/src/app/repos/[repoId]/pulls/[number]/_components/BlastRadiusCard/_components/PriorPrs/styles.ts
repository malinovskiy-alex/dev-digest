const chevron = "shrink-0 text-[var(--text-muted)] transition-transform";

export const cx = {
  wrap: "flex flex-col gap-2",
  header:
    "flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left text-[13px] text-[var(--text-primary)]",
  muted: "shrink-0 text-[var(--text-muted)]",
  title: "font-semibold",
  badge:
    "inline-flex min-w-[20px] items-center justify-center rounded-full bg-[var(--bg-surface)] px-1.5 text-[11px] font-bold text-[var(--text-secondary)]",
  spinner: "animate-spin text-[var(--text-muted)]",
  chevron: `${chevron} ml-auto`,
  chevronOpen: `${chevron} ml-auto rotate-180`,
  panel: "flex flex-col gap-3",
  list: "m-0 flex list-none flex-col gap-3 p-0",
  row: "flex flex-col gap-1",
  rowHead: "flex items-baseline gap-2 text-[13px]",
  number: "mono shrink-0 text-[var(--accent)] no-underline hover:underline",
  numberPlain: "mono shrink-0 text-[var(--text-secondary)]",
  prTitle: "truncate text-[var(--text-primary)]",
  meta: "flex flex-wrap gap-x-3 text-xs text-[var(--text-muted)]",
  files: "m-0 flex list-none flex-wrap gap-x-3 gap-y-0.5 p-0 text-xs",
  file: "mono max-w-full truncate text-[var(--text-secondary)]",
  more: "text-[var(--text-muted)]",
  footer: "flex flex-col gap-1",
  note: "m-0 text-xs text-[var(--text-muted)]",
  warn: "m-0 text-xs text-[var(--warn)]",
  error: "flex flex-col gap-2 text-sm text-[var(--crit)]",
} as const;
