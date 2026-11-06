/* Pure sorting for the agents table (R-59…R-63, D-11). Sorting reorders the rows
   already loaded — no request (R-63). */
import type { AgentPerfTableRow } from "@devdigest/shared";
import { SMALL_SAMPLE_DECIDED } from "@/lib/perf-format";

export type SortKey = "agent" | "runs" | "avgCost" | "avgDuration" | "accept" | "lastRun";
export type SortDir = "asc" | "desc";
export interface SortState {
  key: SortKey;
  dir: SortDir;
}

/** The next sort after activating a header: same column flips, a new column starts descending (R-60). */
export function nextSort(current: SortState, key: SortKey): SortState {
  if (current.key === key) return { key, dir: current.dir === "desc" ? "asc" : "desc" };
  return { key, dir: "desc" };
}

/** A stable key for a row: the agent id, or "deleted" for the folded deleted-agents row. */
export function rowKey(row: AgentPerfTableRow): string {
  return row.agent_id ?? "deleted";
}

/** Compare two strings by code unit — deterministic across locales. */
function cmpStr(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

/** Nulls last in both directions (D-11). */
function cmpNullable(a: number | null, b: number | null, dir: SortDir): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return dir === "asc" ? a - b : b - a;
}

/** Accept-rate tier (R-62): A ≥ 5 decided, B 1–4, C none. */
function tier(r: AgentPerfTableRow): 0 | 1 | 2 {
  const d = r.figures.decided;
  return d >= SMALL_SAMPLE_DECIDED ? 0 : d > 0 ? 1 : 2;
}

function cmpAccept(a: AgentPerfTableRow, b: AgentPerfTableRow, dir: SortDir): number {
  const ta = tier(a);
  const tb = tier(b);
  // Tier order A → B → C in either direction (R-62).
  if (ta !== tb) return ta - tb;
  if (ta === 0) return cmpNullable(a.figures.accept_rate, b.figures.accept_rate, dir);
  if (ta === 1) {
    const byDecided = b.figures.decided - a.figures.decided;
    if (byDecided !== 0) return byDecided;
    return cmpNullable(a.figures.accept_rate, b.figures.accept_rate, "desc");
  }
  return 0;
}

function lastRunMs(r: AgentPerfTableRow): number | null {
  if (!r.figures.last_run_at) return null;
  const t = Date.parse(r.figures.last_run_at);
  return Number.isNaN(t) ? null : t;
}

/**
 * Rows in display order. Every tie ends at the label (ascending), then the agent
 * id with the deleted row last, so the order is total.
 */
export function sortRows(
  rows: readonly AgentPerfTableRow[],
  sort: SortState,
  label: (row: AgentPerfTableRow) => string,
): AgentPerfTableRow[] {
  const primary = (a: AgentPerfTableRow, b: AgentPerfTableRow): number => {
    switch (sort.key) {
      case "agent": {
        const c = cmpStr(label(a), label(b));
        return sort.dir === "asc" ? c : -c;
      }
      case "runs":
        return cmpNullable(a.figures.runs, b.figures.runs, sort.dir);
      case "avgCost":
        return cmpNullable(a.figures.avg_cost_usd, b.figures.avg_cost_usd, sort.dir);
      case "avgDuration":
        return cmpNullable(a.figures.avg_duration_ms, b.figures.avg_duration_ms, sort.dir);
      case "accept":
        return cmpAccept(a, b, sort.dir);
      case "lastRun":
        return cmpNullable(lastRunMs(a), lastRunMs(b), sort.dir);
    }
  };
  return [...rows].sort((a, b) => {
    const p = primary(a, b);
    if (p !== 0) return p;
    const byLabel = cmpStr(label(a), label(b));
    if (byLabel !== 0) return byLabel;
    if (a.agent_id === b.agent_id) return 0;
    if (a.agent_id === null) return 1;
    if (b.agent_id === null) return -1;
    return cmpStr(a.agent_id, b.agent_id);
  });
}
