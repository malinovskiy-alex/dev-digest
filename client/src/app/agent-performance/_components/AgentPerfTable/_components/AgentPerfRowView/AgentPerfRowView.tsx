/* AgentPerfRowView — one agents-table row and its expand panel.
   - colour swatch from the agent id, neutral for "Deleted agents" (R-102, R-103),
     `aria-hidden` — the name carries the meaning;
   - the expand control "Details for <name>" with `aria-expanded` (R-64, R-86),
     holding the truncated name with the full name on hover and focus (R-65, D-12);
   - zero-run rows show "0" and "—" (R-57); the deleted row has no View link (R-58);
   - View "View stats for <name>" opens the Stats tab with the same range (R-56, R-86);
   - the panel lists accepted / dismissed / pending, runs without a price and
     cost per model from the loaded row (R-64). */
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge, Icon } from "@devdigest/ui";
import type { AgentPerfTableRow } from "@devdigest/shared";
import { AcceptRateValue } from "@/components/accept-rate-value";
import { HoverNote } from "@/components/hover-note";
import { LastRunTime } from "@/components/last-run-time";
import { formatCostUsd } from "@/lib/format-cost";
import { agentColor } from "@/lib/perf-colors";
import { formatDurationSec, segmentLabel } from "@/lib/perf-format";
import { COLUMN_COUNT } from "../../constants";
import { CHEVRON_SIZE } from "./constants";
import { cx } from "./styles";

export function AgentPerfRowView({
  row,
  label,
  expanded,
  onToggle,
  viewHref,
}: {
  row: AgentPerfTableRow;
  /** The display name — "Deleted agents" for the folded row. */
  label: string;
  expanded: boolean;
  onToggle: () => void;
  /** null on the deleted row (R-58). */
  viewHref: string | null;
}): React.JSX.Element {
  const t = useTranslations("agentPerformance");
  const panelId = React.useId();
  const f = row.figures;
  const Chevron = expanded ? Icon.ChevronDown : Icon.ChevronRight;
  const color = agentColor(row.kind === "deleted" ? null : row.agent_id);

  return (
    <>
      <tr className={cx.tr}>
        <td className={cx.td}>
          <div className={cx.agentCell}>
            <span aria-hidden="true" className={cx.swatch} style={{ background: color }} />
            <HoverNote focusable={false} className={cx.nameNote} tooltip={label}>
              <button
                type="button"
                className={cx.expandBtn}
                aria-expanded={expanded}
                aria-controls={panelId}
                aria-label={t("table.detailsLabel", { name: label })}
                onClick={onToggle}
              >
                <Chevron size={CHEVRON_SIZE} aria-hidden="true" />
                <span className={cx.name}>{label}</span>
              </button>
            </HoverNote>
            {row.enabled === false && <Badge color="var(--text-muted)">{t("table.disabled")}</Badge>}
          </div>
        </td>
        <td className={cx.num}>{f.runs}</td>
        <td className={cx.num}>{formatCostUsd(f.avg_cost_usd)}</td>
        <td className={cx.num}>{formatDurationSec(f.avg_duration_ms)}</td>
        <td className={cx.td}>
          <AcceptRateValue figures={f} comparison={row.comparison} variant="row" />
        </td>
        <td className={cx.td}>
          <LastRunTime iso={f.last_run_at} />
        </td>
        <td className={cx.td}>
          {viewHref && (
            <Link href={viewHref} className={cx.view} aria-label={t("table.viewLabel", { name: label })}>
              {t("table.view")}
            </Link>
          )}
        </td>
      </tr>
      <tr id={panelId} hidden={!expanded}>
        <td colSpan={COLUMN_COUNT} className={cx.panel}>
          {expanded && <RowDetails row={row} />}
        </td>
      </tr>
    </>
  );
}

function RowDetails({ row }: { row: AgentPerfTableRow }): React.JSX.Element {
  const t = useTranslations("agentPerformance");
  const f = row.figures;
  const unknown = t("breakdown.unknownModel");
  const counts: [string, number][] = [
    [t("details.accepted"), f.accepted],
    [t("details.dismissed"), f.dismissed],
    [t("details.pending"), f.pending],
    [t("details.unpriced"), f.unpriced_runs],
  ];
  return (
    <div className={cx.panelGrid}>
      <dl className={cx.dl}>
        {counts.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className={cx.dt}>{k}</dt>
            <dd className={cx.dd}>{v}</dd>
          </React.Fragment>
        ))}
      </dl>
      <div>
        <p className={cx.modelTitle}>{t("details.costByModel")}</p>
        {row.cost_by_model.length === 0 ? (
          <p className={cx.dd}>{t("details.noModelCost")}</p>
        ) : (
          <ul className={cx.modelList}>
            {row.cost_by_model.map((m) => (
              <li key={`${m.provider ?? ""}/${m.model ?? ""}`} className={cx.modelItem}>
                <span>{segmentLabel(m, row.cost_by_model, unknown)}</span>
                <span className={cx.modelCost}>{formatCostUsd(m.cost_usd)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
