/** Tailwind class strings for the in-tree hover/focus tooltip (D-26). */
export const cx = {
  wrap: "group relative inline-flex cursor-help items-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]",
  tip: "absolute left-0 top-full z-20 mt-1 hidden min-w-[220px] max-w-[360px] flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-[12.5px] text-[var(--text-secondary)] shadow-lg group-hover:flex group-focus-within:flex",
} as const;
