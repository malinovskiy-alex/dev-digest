/**
 * The five sections in display order (AC-07), with their DOM ids, title keys
 * and the `@devdigest/ui` icon of their header tile (design D-8).
 */
export const SECTION_ORDER = [
  { key: "architecture", id: "tour-architecture", titleKey: "sections.architecture", icon: "Workflow" },
  { key: "critical-paths", id: "tour-critical-paths", titleKey: "sections.criticalPaths", icon: "Activity" },
  { key: "run-locally", id: "tour-run-locally", titleKey: "sections.runLocally", icon: "Command" },
  { key: "reading-path", id: "tour-reading-path", titleKey: "sections.readingPath", icon: "ListChecks" },
  { key: "first-tasks", id: "tour-first-tasks", titleKey: "sections.firstTasks", icon: "Target" },
] as const;

export type SectionKey = (typeof SECTION_ORDER)[number]["key"];

/** Height of one section-shaped loading skeleton (AC-17). */
export const SKELETON_HEIGHT = 96;
