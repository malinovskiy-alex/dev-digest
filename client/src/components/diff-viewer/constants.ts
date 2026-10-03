/** Constants for the DiffViewer. */
import type { Severity } from "@/lib/types";

/** Files with this many or fewer changed lines start expanded. */
export const AUTO_EXPAND_MAX_LINES = 200;

/** Matches a unified-diff hunk header, e.g. `@@ -1,2 +1,3 @@`. */
export const HUNK_HEADER_RE = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/** Severity order for picking a file's / line's dominant finding (higher wins). */
export const SEVERITY_RANK: Record<Severity, number> = {
  CRITICAL: 3,
  WARNING: 2,
  SUGGESTION: 1,
};

/** `shell` i18n key of the right-aligned label on a line that carries findings. */
export const FINDING_LINE_LABEL_KEY: Record<Severity, string> = {
  CRITICAL: "diffViewer.findingLabel.CRITICAL",
  WARNING: "diffViewer.findingLabel.WARNING",
  SUGGESTION: "diffViewer.findingLabel.SUGGESTION",
};
