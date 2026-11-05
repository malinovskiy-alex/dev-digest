import type { CustomRangeError, PerfPreset } from "@/lib/perf-range";

/** The two preset buttons, in display order (R-32). Keys resolve under `agentPerformance`. */
export const PRESET_BUTTONS: readonly { preset: PerfPreset; labelKey: string }[] = [
  { preset: "1d", labelKey: "range.oneDay" },
  { preset: "30d", labelKey: "range.thirtyDays" },
];

/** Message key per custom-range error (R-36, R-37). */
export const ERROR_KEYS: Record<CustomRangeError, string> = {
  missing: "range.errors.missing",
  endBeforeStart: "range.errors.endBeforeStart",
  future: "range.errors.future",
  tooEarly: "range.errors.tooEarly",
};

/** Short (title) and sentence label keys per preset (R-40, D-9). */
export const PRESET_LABEL_KEYS: Record<PerfPreset, { short: string; sentence: string }> = {
  "1d": { short: "range.short.oneDay", sentence: "range.sentence.oneDay" },
  "30d": { short: "range.short.thirtyDays", sentence: "range.sentence.thirtyDays" },
};

/** How a custom range's dates are written in its label (D-9). */
export const RANGE_DATE_FORMAT = { day: "numeric", month: "short", year: "numeric" } as const;
