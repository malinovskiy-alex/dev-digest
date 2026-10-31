/** Tailwind class strings for ContextDocRow. Same visual weights as the agent SkillRow. */
export const cx = {
  row: (o: { enabled: boolean; inherited: boolean; dragging: boolean; movable: boolean }) =>
    [
      "flex items-center gap-3 rounded-lg border border-solid px-3.5 py-2.5",
      o.enabled ? "border-[var(--border-strong)] bg-[var(--bg-elevated)]" : "border-[var(--border)] bg-[var(--bg-surface)]",
      o.dragging ? "opacity-40" : o.inherited ? "opacity-60" : "opacity-100",
      o.movable ? "cursor-grab" : "cursor-default",
    ].join(" "),
  handle: (inert: boolean) =>
    [
      "inline-grid h-5 w-5 shrink-0 place-items-center border-0 bg-transparent p-0",
      inert ? "cursor-not-allowed text-[var(--border-strong)]" : "cursor-grab text-[var(--text-muted)]",
    ].join(" "),
  handleSpacer: "inline-block h-5 w-5 shrink-0",
  name: (enabled: boolean) =>
    `font-mono text-[13px] font-semibold ${enabled ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`,
  folder: "min-w-0 truncate font-mono text-[12px] text-[var(--text-muted)]",
  spacer: "min-w-2 flex-1",
  tokens: "shrink-0 font-mono text-[12px] text-[var(--text-muted)]",
} as const;
