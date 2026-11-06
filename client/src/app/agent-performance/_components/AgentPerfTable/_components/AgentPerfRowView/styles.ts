/** Tailwind class strings for one agents-table row and its details panel (L08). */
export const cx = {
  tr: "border-b border-[var(--border)] last:border-b-0",
  td: "px-3 py-2.5 align-middle text-[var(--text-primary)]",
  num: "px-3 py-2.5 align-middle tnum text-[var(--text-primary)]",
  agentCell: "flex min-w-0 max-w-[260px] items-center gap-2",
  swatch: "inline-block h-2.5 w-2.5 shrink-0 rounded-sm",
  expandBtn:
    "inline-flex min-w-0 items-center gap-1 bg-transparent border-0 p-0 text-left text-[13px] font-semibold text-[var(--text-primary)] cursor-pointer hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]",
  // D-12: the name truncates; the full name is in the button's accessible name and the tooltip.
  name: "block min-w-0 max-w-[200px] truncate",
  nameNote: "min-w-0",
  view: "text-[var(--accent)] font-semibold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]",
  panel: "px-6 py-3 bg-[var(--bg-primary)] text-[12.5px]",
  panelGrid: "flex flex-wrap gap-x-8 gap-y-3",
  dl: "m-0 grid grid-cols-[auto_auto] gap-x-4 gap-y-1",
  dt: "text-[var(--text-muted)]",
  dd: "m-0 tnum text-[var(--text-primary)]",
  modelTitle: "m-0 mb-1 text-[var(--text-muted)]",
  modelList: "m-0 flex list-none flex-col gap-1 p-0",
  modelItem: "flex items-center gap-3",
  modelCost: "tnum font-semibold",
} as const;
