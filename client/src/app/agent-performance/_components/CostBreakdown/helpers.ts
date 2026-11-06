/* Pure segment builders for the two cost donuts. The server already orders both
   lists by cost, highest first (R-67); the order is kept as received. */
import type { PerfAgentCost, PerfModelCost } from "@devdigest/shared";
import { agentColor, modelColor } from "@/lib/perf-colors";
import { segmentLabel } from "@/lib/perf-format";
import type { DonutSegment } from "./_components/CostDonut";

/** By-agent segments; the deleted row is labelled and coloured neutrally (R-21, R-103). */
export function agentSegments(rows: readonly PerfAgentCost[], deletedLabel: string): DonutSegment[] {
  return rows.map((r) => ({
    key: r.agent_id ?? "deleted",
    label: r.kind === "deleted" ? deletedLabel : (r.agent_name ?? ""),
    value: r.cost_usd,
    // Same function as the table swatch, so an agent has one colour on both (R-102).
    color: agentColor(r.kind === "deleted" ? null : r.agent_id),
  }));
}

/** By-model segments; no stored model → "Unknown model", neutral (R-22). */
export function modelSegments(rows: readonly PerfModelCost[], unknownLabel: string): DonutSegment[] {
  return rows.map((m) => ({
    key: `${m.provider ?? ""}/${m.model ?? ""}`,
    label: segmentLabel(m, rows, unknownLabel),
    value: m.cost_usd,
    color: modelColor(m.provider, m.model),
  }));
}
