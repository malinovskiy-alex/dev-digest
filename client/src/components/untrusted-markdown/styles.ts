/** Tailwind class strings for UntrustedMarkdown. Same look as the `@devdigest/ui` Markdown primitive. */
export const cx = {
  root: "dd-md leading-[1.55]",
  p: "m-0 mb-2.5",
  strong: "font-[650] text-[var(--text-primary)]",
  code: "mono rounded bg-[var(--bg-hover)] px-1.5 py-px text-[0.92em] text-[var(--accent-text)]",
  link: "text-[var(--accent-text)] underline",
  // A relative link points into the repo, not into the studio: shown, not followed.
  inertLink: "text-[var(--text-secondary)] underline decoration-dotted",
  image:
    "inline-flex items-center gap-1 rounded border border-dashed border-[var(--border)] px-1.5 text-[0.92em] text-[var(--text-muted)]",
} as const;
