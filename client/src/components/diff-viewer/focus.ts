/* Focus target for the DiffViewer (L05 PR Brief → Files changed): a file and,
   optionally, a new-side line to open, scroll to, highlight and focus
   (R-53, R-54, R-57, R-59, D-33). Pure helpers + the shape the viewer takes. */
import type { Line } from "./helpers";

/** The file (and new-side line) the viewer should bring into view. */
export interface DiffFocus {
  path: string;
  /** null → the file's header (no line asked for). */
  line: number | null;
  /**
   * The target was already opened, scrolled to and focused once. The line
   * stays highlighted, but nothing is forced open or scrolled again — not when
   * the user collapses and reopens the group or file, nor when the Smart /
   * Original toggle remounts the cards (F-07). Owned above the viewer.
   */
  handled?: boolean;
  /** Called once the target has been scrolled to and focused. */
  onHandled?: () => void;
}

/** A stable identity for a focus target, for "handled" bookkeeping. */
export function focusKey(focus: Pick<DiffFocus, "path" | "line">): string {
  return `${focus.path}:${focus.line ?? ""}`;
}

/**
 * Index of the rendered line that shows new-side line `line` (an added or a
 * context line), or -1 when no rendered line does — outside every hunk, or no
 * patch text (R-57).
 */
export function focusLineIndex(lines: Line[], line: number | null): number {
  if (line == null) return -1;
  return lines.findIndex((l) => (l.kind === "add" || l.kind === "ctx") && l.newNo === line);
}
