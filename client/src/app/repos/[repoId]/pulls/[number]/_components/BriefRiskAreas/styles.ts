/** Tailwind class strings for the PR Brief's Risk areas list. */
export const cx = {
  list: "m-0 flex list-none flex-col gap-2.5 p-0",
  row: "flex flex-col gap-1.5",
  head: "flex min-w-0 items-start gap-2",
  dot: "mt-[6px] h-2 w-2 shrink-0 rounded-full",
  main: "flex min-w-0 flex-1 flex-col gap-1",
  title: "m-0 text-[13px] font-medium text-[var(--text-primary)]",
  expand:
    "shrink-0 cursor-pointer rounded border-0 bg-transparent p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]",
  chevron: "transition-transform",
  chevronOpen: "rotate-90 transition-transform",
  details: "ml-4 flex flex-col gap-1.5",
  explanation: "m-0 whitespace-pre-line text-[13px] text-[var(--text-secondary)]",
  refs: "m-0 flex list-none flex-col gap-1 p-0",
  empty: "m-0 text-[13px] italic text-[var(--text-muted)]",
  skeleton: "flex flex-col gap-2",
} as const;
