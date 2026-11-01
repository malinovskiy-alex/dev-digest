/** The five sections in display order (AC-07), with their DOM ids and title keys. */
export const SECTION_ORDER = [
  { key: "architecture", id: "tour-architecture", titleKey: "sections.architecture" },
  { key: "critical-paths", id: "tour-critical-paths", titleKey: "sections.criticalPaths" },
  { key: "run-locally", id: "tour-run-locally", titleKey: "sections.runLocally" },
  { key: "reading-path", id: "tour-reading-path", titleKey: "sections.readingPath" },
  { key: "first-tasks", id: "tour-first-tasks", titleKey: "sections.firstTasks" },
] as const;

export type SectionKey = (typeof SECTION_ORDER)[number]["key"];

/** Height of one section-shaped loading skeleton (AC-17). */
export const SKELETON_HEIGHT = 96;
