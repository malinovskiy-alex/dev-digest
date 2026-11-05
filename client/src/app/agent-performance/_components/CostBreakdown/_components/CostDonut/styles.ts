/** Tailwind class strings for one cost donut and its legend (L08). */
export const cx = {
  wrap: "flex flex-wrap items-center gap-5",
  chart: "shrink-0",
  legend: "m-0 flex min-w-[160px] flex-1 list-none flex-col gap-2 p-0",
  item: "flex items-center gap-2.5 text-[13px]",
  swatch: "inline-block h-2.5 w-2.5 shrink-0 rounded-sm",
  label: "min-w-0 flex-1 truncate text-[var(--text-secondary)]",
  value: "tnum font-semibold text-[var(--text-primary)]",
} as const;
