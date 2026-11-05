import type { FindingsBreakdown } from "@devdigest/shared";
import {
  CATEGORY_ORDER,
  SEVERITY_ORDER,
  SMALL_SAMPLE_FINDINGS,
  type WidgetCategory,
  type WidgetSeverity,
} from "./constants";

export interface WidgetEntry<K extends string> {
  key: K;
  count: number;
  /** whole percent of the total, computed for this entry alone (R-62) */
  pct: number;
}

/** Whole percent of `count` in `total`, per entry — the shown values may add up to 99–101 (R-62). */
export function entryPercent(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

/** The five categories in fixed order, zeros included, then `other` only when above 0 (R-61). */
export function categoryEntries(f: FindingsBreakdown): WidgetEntry<WidgetCategory>[] {
  const keys: WidgetCategory[] = [...CATEGORY_ORDER];
  if (f.by_category.other > 0) keys.push("other");
  return keys.map((key) => ({ key, count: f.by_category[key], pct: entryPercent(f.by_category[key], f.total) }));
}

/** CRITICAL, WARNING, SUGGESTION, zeros included, then `other` only when above 0 (R-63). */
export function severityEntries(f: FindingsBreakdown): WidgetEntry<WidgetSeverity>[] {
  const keys: WidgetSeverity[] = [...SEVERITY_ORDER];
  if (f.by_severity.other > 0) keys.push("other");
  return keys.map((key) => ({ key, count: f.by_severity[key], pct: entryPercent(f.by_severity[key], f.total) }));
}

/** True for 1 … 4 findings (R-64); 0 shows the empty state instead. */
export function isSmallFindingsSample(total: number): boolean {
  return total > 0 && total < SMALL_SAMPLE_FINDINGS;
}
