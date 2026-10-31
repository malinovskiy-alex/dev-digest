/** Tailwind class strings for the skill ContextTab. */
export const cx = {
  wrap: "flex max-w-[860px] flex-col gap-3",
  h2: "m-0 text-[18px] font-bold text-[var(--text-primary)]",
  hint: "m-0 text-[13px] leading-relaxed text-[var(--text-secondary)]",
  skeletons: "flex flex-col gap-2.5",
  footer: "flex flex-col gap-1.5 border-0 border-t border-solid border-[var(--border)] pt-3",
  total: "font-mono text-[13px] font-semibold text-[var(--text-primary)]",
  label: "text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]",
  pre: "m-0 overflow-x-auto rounded-md bg-[var(--code-bg)] p-3 font-mono text-[12px] text-[var(--text-primary)]",
  none: "m-0 text-[12px] text-[var(--text-muted)]",
} as const;
