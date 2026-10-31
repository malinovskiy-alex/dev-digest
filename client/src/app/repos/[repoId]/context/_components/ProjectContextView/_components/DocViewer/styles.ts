/** Tailwind class strings for DocViewer. */
export const cx = {
  viewer: "flex flex-col gap-4",
  header: "flex flex-col gap-2 border-0 border-b border-solid border-[var(--border)] pb-3",
  name: "m-0 truncate font-mono text-[16px] font-bold text-[var(--text-primary)]",
  meta: "flex flex-wrap items-center gap-2",
  path: "m-0 break-all font-mono text-[12px] text-[var(--text-muted)]",
  skeletons: "flex flex-col gap-2",
  notFound: "flex flex-col items-start gap-2",
  notFoundText: "m-0 text-[13px] text-[var(--text-secondary)]",
  body: "text-[14px] text-[var(--text-secondary)]",
} as const;
