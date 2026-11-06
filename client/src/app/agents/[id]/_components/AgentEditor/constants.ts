import type { IconName } from "@devdigest/ui";

/** Editor tab descriptor. `labelKey` resolves under `ns` (default: the `agents` namespace). */
export interface EditorTab {
  key: string;
  labelKey: string;
  icon: IconName;
  /** L08: the Stats tab's strings live with the rest of Agent Performance (D-16). */
  ns?: "agents" | "agentPerformance";
}

/**
 * Editor tabs. L02 adds Skills beside Config; L08 adds Stats. The mockup's
 * Evals / CI tabs stay unbuilt — the eval pipeline is a later lesson, and a tab
 * with no screen behind it is a trap for the next reader.
 */
export const TABS: readonly EditorTab[] = [
  { key: "config", labelKey: "editor.tabs.config", icon: "Settings" },
  { key: "skills", labelKey: "editor.tabs.skills", icon: "Sparkles" },
  // L05 — project-context documents attached to this agent.
  { key: "context", labelKey: "editor.tabs.context", icon: "FileText" },
  // L08 — this agent's figures for a range, the same rules as its Agent Performance row.
  { key: "stats", labelKey: "stats.tabLabel", icon: "Activity", ns: "agentPerformance" },
];
