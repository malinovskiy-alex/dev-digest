/** Tailwind class strings for one tour section. */
export const cx = {
  section:
    "scroll-mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-[18px]",
  head: "flex items-center justify-between gap-2",
  title: "m-0 text-[15px] font-bold text-[var(--text-primary)] outline-none",
  toggle:
    "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
  body: "mt-3 flex flex-col gap-3",
  // `hidden` alone loses to a `display` utility, so a collapsed body gets this class too.
  bodyHidden: "hidden",
} as const;
