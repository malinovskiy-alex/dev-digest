/** Tailwind class strings for the architecture section. */
export const cx = {
  // Body-size prose; inline code as an accent mono chip on a tinted ground
  // (design D-9). Paragraphs are spaced by a gap on the markdown root: the
  // unlayered `p { margin: 0 }` in `@devdigest/ui` styles.css beats any
  // Tailwind margin utility on the `<p>` (F-44).
  prose:
    "text-[15px] leading-[1.65] text-[var(--text-secondary)] [&_code]:rounded-md [&_code]:bg-[var(--accent-bg)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-[var(--accent)] [&_.dd-md]:flex [&_.dd-md]:flex-col [&_.dd-md]:gap-3",
  gap: "m-0 text-[14px] text-[var(--text-secondary)]",
  grid: "grid grid-cols-1 gap-4 md:grid-cols-2",
  group: "flex flex-col gap-2 rounded-lg bg-[var(--bg-surface)] px-4 py-3",
  groupTitle: "m-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]",
  list: "m-0 flex list-none flex-col gap-1 p-0 text-[14px] text-[var(--text-primary)]",
  mono: "font-mono text-[13px]",
} as const;
