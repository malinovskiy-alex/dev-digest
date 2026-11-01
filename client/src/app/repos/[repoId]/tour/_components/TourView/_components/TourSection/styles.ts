/** Tailwind class strings for one tour section (design D-7, D-8). */
export const cx = {
  section:
    "scroll-mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6",
  head: "flex items-center justify-between gap-3",
  heading: "flex min-w-0 items-center gap-3",
  tile:
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-bg)] text-[var(--accent)]",
  title: "m-0 text-[19px] font-semibold tracking-[-0.01em] text-[var(--text-primary)] outline-none",
  toggle:
    "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]",
  // Open → the chevron points up (design D-8); `@devdigest/ui` has no ChevronUp.
  chevronOpen: "rotate-180",
  body: "mt-5 flex flex-col gap-4",
  // `hidden` alone loses to a `display` utility, so a collapsed body gets this class too.
  bodyHidden: "hidden",
} as const;
