import type { GraphNodeKind } from "./helpers";

/* SVG colours go through CSS variables (the design tokens), via Tailwind's
   `stroke-[color:…]` / `fill-[color:…]` — never hex in markup. */

const dot = "inline-block h-2 w-2 rounded-full";
const rect = "fill-[color:var(--bg-surface)] stroke-[1.5]";
const text = "mono text-[11px]";

export const cx = {
  wrap: "flex flex-col gap-2",
  svg: "h-auto w-full",
  edge: "fill-none stroke-[color:var(--border)] stroke-[1.25]",
  empty: "m-0 text-[13px] text-[var(--text-secondary)]",
  legend: "m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1 p-0 text-xs text-[var(--text-muted)]",
  legendItem: "inline-flex items-center gap-1.5",
  dotSymbol: `${dot} bg-[var(--accent)]`,
  dotCaller: `${dot} bg-[var(--border-strong)]`,
  dotEndpoint: `${dot} bg-[var(--accent)] opacity-60`,
  dotCron: `${dot} bg-[var(--warn)]`,
} as const;

/** Box style per node kind: symbol and endpoint in the accent blue, caller neutral, cron amber. */
export const NODE_RECT: Record<GraphNodeKind, string> = {
  symbol: `${rect} stroke-[color:var(--accent)]`,
  caller: `${rect} stroke-[color:var(--border-strong)]`,
  endpoint: `${rect} stroke-[color:var(--accent)] [stroke-dasharray:4_2]`,
  cron: `${rect} stroke-[color:var(--warn)]`,
  more: `${rect} stroke-[color:var(--border)] [stroke-dasharray:2_2]`,
};

export const NODE_TEXT: Record<GraphNodeKind, string> = {
  symbol: `${text} fill-[color:var(--text-primary)] font-semibold`,
  caller: `${text} fill-[color:var(--text-secondary)]`,
  endpoint: `${text} fill-[color:var(--accent)]`,
  cron: `${text} fill-[color:var(--warn)]`,
  more: `${text} fill-[color:var(--text-muted)] italic`,
};
