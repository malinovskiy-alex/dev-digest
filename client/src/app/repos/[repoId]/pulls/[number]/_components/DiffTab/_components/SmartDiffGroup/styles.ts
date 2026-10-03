/** Tailwind class strings for SmartDiffGroup. */

export const section = "flex flex-col gap-2.5";

/** The whole header is one button: chevron, square, label, description, counters. */
export const header =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent px-1 py-1.5 text-left";

export const chevron = "shrink-0 text-text-muted transition-transform duration-150";
export const chevronOpen = "rotate-90";

/** The role's colour square; the colour class comes from ROLE_META. */
export const square = "size-2.5 shrink-0 rounded-sm";

export const label = "shrink-0 text-[13px] font-bold text-text-primary";
export const description = "min-w-0 truncate text-[12.5px] text-text-muted";
export const spacer = "flex-1";

/** Red dot + the number of files with findings. */
export const findingsCount = "inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-crit";
export const findingsDot = "size-2 rounded-full bg-crit";

export const filesCount = "shrink-0 text-xs text-text-muted tabular-nums";
