import type { SortKey, SortState } from "./helpers";

/** The table opens sorted by accept rate, highest first (R-59). */
export const INITIAL_SORT: SortState = { key: "accept", dir: "desc" };

/** The six sortable columns, in display order (R-52, R-60). Keys resolve under `agentPerformance`. */
export const SORTABLE_COLUMNS: readonly { key: SortKey; labelKey: string; numeric: boolean }[] = [
  { key: "agent", labelKey: "table.agent", numeric: false },
  { key: "runs", labelKey: "table.runs", numeric: true },
  { key: "avgCost", labelKey: "table.avgCost", numeric: true },
  { key: "avgDuration", labelKey: "table.avgDuration", numeric: true },
  { key: "accept", labelKey: "table.accept", numeric: false },
  { key: "lastRun", labelKey: "table.lastRun", numeric: false },
];

/** Columns of a row, including View — the expand panel spans all of them. */
export const COLUMN_COUNT = SORTABLE_COLUMNS.length + 1;
