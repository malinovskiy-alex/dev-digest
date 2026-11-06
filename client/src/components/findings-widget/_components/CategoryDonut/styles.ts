/** Tailwind class strings for the category ring and its legend (L08 skill-stats). */
export const cx = {
  wrap: "flex flex-wrap items-center gap-5",
  chart: "relative shrink-0",
  centre: "tnum pointer-events-none absolute inset-0 flex items-center justify-center text-[20px] font-bold text-[var(--text-primary)]",
  legend: "m-0 flex min-w-[160px] flex-1 list-none flex-col gap-2 p-0",
  item: "flex items-center gap-2.5 text-[13px]",
  swatch: "inline-block h-2.5 w-2.5 shrink-0 rounded-sm",
  label: "min-w-0 flex-1 truncate text-[var(--text-secondary)]",
  value: "tnum font-semibold text-[var(--text-primary)]",
} as const;
