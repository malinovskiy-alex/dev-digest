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
 * Editor tabs. The mockup also shows a `Stats` tab; it stays unbuilt for the
 * same reason the agent editor's does — there is no per-skill usage data behind
 * it yet, and a tab with no screen behind it is a trap for the next reader.
 */
export const TABS: readonly EditorTab[] = [
  { key: "config", labelKey: "editor.tabs.config", icon: "Settings" },
  { key: "preview", labelKey: "editor.tabs.preview", icon: "FileText" },
  { key: "versions", labelKey: "editor.tabs.versions", icon: "GitBranch" },
];
