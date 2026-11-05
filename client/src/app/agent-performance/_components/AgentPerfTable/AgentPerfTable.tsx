/* AgentPerfTable — one row per workspace agent plus the folded "Deleted agents"
   row (R-52, R-24, R-21). Opens sorted by accept rate, highest first (R-59);
   the six sortable headers are buttons inside `<th aria-sort>` (R-60, R-85).
   Sorting and expanding work on the rows already loaded — no request
   (R-63, R-64, R-74). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import type { AgentPerfTableRow } from "@devdigest/shared";
import { statsHref, type PerfRange, type PerfRangeChoice } from "@/lib/perf-range";
import { AgentPerfRowView } from "./_components/AgentPerfRowView";
import { INITIAL_SORT, SORTABLE_COLUMNS } from "./constants";
import { nextSort, rowKey, sortRows, type SortState } from "./helpers";
import { cx } from "./styles";

export function AgentPerfTable({
  rows,
  choice,
  range,
  rangeShort,
}: {
  rows: readonly AgentPerfTableRow[];
  /** The applied choice and its instants — the View link carries both (R-56). */
  choice: PerfRangeChoice;
  range: PerfRange;
  /** "(30D)" etc. for the Runs header (R-40). */
  rangeShort: string;
}): React.JSX.Element {
  const t = useTranslations("agentPerformance");
  const [sort, setSort] = React.useState<SortState>(INITIAL_SORT);
  const [open, setOpen] = React.useState<ReadonlySet<string>>(() => new Set());

  const deletedLabel = t("table.deletedAgents");
  const label = (r: AgentPerfTableRow) => (r.kind === "deleted" ? deletedLabel : (r.agent_name ?? ""));
  const sorted = sortRows(rows, sort, label);

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className={cx.scroll}>
      <table className={cx.table}>
        <caption className="sr-only">{t("table.caption")}</caption>
        <thead>
          <tr>
            {SORTABLE_COLUMNS.map((c) => {
              const active = sort.key === c.key;
              const SortIcon = sort.dir === "desc" ? Icon.ArrowDown : Icon.ArrowUp;
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={cx.th}
                  aria-sort={active ? (sort.dir === "desc" ? "descending" : "ascending") : undefined}
                >
                  <button type="button" className={cx.sortBtn} onClick={() => setSort((s) => nextSort(s, c.key))}>
                    <span className={cx.sortLine}>
                      {t(c.labelKey, { range: rangeShort })}
                      {active && <SortIcon size={11} aria-hidden="true" />}
                    </span>
                    {c.key === "avgCost" && <span className={cx.subLabel}>{t("estimate.label")}</span>}
                  </button>
                </th>
              );
            })}
            <th scope="col" className={cx.th}>
              {t("table.view")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const key = rowKey(r);
            return (
              <AgentPerfRowView
                key={key}
                row={r}
                label={label(r)}
                expanded={open.has(key)}
                onToggle={() => toggle(key)}
                viewHref={r.kind === "agent" && r.agent_id ? statsHref(r.agent_id, choice, range) : null}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
