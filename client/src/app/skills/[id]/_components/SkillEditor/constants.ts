import type { IconName } from "@devdigest/ui";

/** Constants for the skill editor. */

/** Rows for the body editor — a skill body is prose, not a one-liner. */
export const BODY_ROWS = 14;

/** Rows for the description editor: it is one directive sentence, not an essay. */
export const DESCRIPTION_ROWS = 3;

/** Editor tab descriptor. `labelKey` resolves under the `skills` namespace. */
export interface EditorTab {
  key: string;
  labelKey: string;
  icon: IconName;
}

/**
 * Editor tabs, in display order. `stats` (L08 skill-stats R-34) sits between
 * Preview and Versions: the figures of the agents that use the skill now.
 */
export const TABS: readonly EditorTab[] = [
  { key: "config", labelKey: "editor.tabs.config", icon: "Settings" },
  { key: "preview", labelKey: "editor.tabs.preview", icon: "FileText" },
  { key: "stats", labelKey: "editor.tabs.stats", icon: "Activity" },
  { key: "versions", labelKey: "editor.tabs.versions", icon: "GitBranch" },
  // L05 — project-context documents every agent with this skill inherits.
  { key: "context", labelKey: "editor.tabs.context", icon: "FileText" },
];

/** Placeholder height, px, while the Stats tab's code loads. */
export const STATS_LOADING_HEIGHT = 200;
