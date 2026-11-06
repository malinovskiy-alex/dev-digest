import type { FindingCategoryCounts, FindingSeverityCounts } from "@devdigest/shared";

/**
 * The legend's categories, in display order (R-61); `other` follows only when
 * above 0. A runtime list, local — the client imports types only from
 * `@devdigest/shared`.
 */
export const CATEGORY_ORDER = ["security", "bug", "perf", "style", "test"] as const;
export type WidgetCategory = (typeof CATEGORY_ORDER)[number] | "other";

/** The severity row, in display order (R-63); `other` follows only when above 0. */
export const SEVERITY_ORDER = ["CRITICAL", "WARNING", "SUGGESTION"] as const;
export type WidgetSeverity = (typeof SEVERITY_ORDER)[number] | "other";

// Compile-time check: the two lists plus `other` are exactly the contract's keys.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const categoriesMatch: Same<WidgetCategory, keyof FindingCategoryCounts> = true;
const severitiesMatch: Same<WidgetSeverity, keyof FindingSeverityCounts> = true;
void categoriesMatch;
void severitiesMatch;

/** One fixed colour per category, the same on both tabs and every load (R-67, D-10). */
export const CATEGORY_COLOR: Record<WidgetCategory, string> = {
  security: "#ef4444",
  bug: "#f97316",
  perf: "#8b5cf6",
  style: "#3b82f6",
  test: "#10b981",
  other: "var(--info)",
};

/** "Small sample" shows while the widget has 1 … SMALL_SAMPLE_FINDINGS − 1 findings (R-64, BQ-2). */
export const SMALL_SAMPLE_FINDINGS = 5;

/** Severity icon size, px. */
export const SEVERITY_ICON_SIZE = 13;
