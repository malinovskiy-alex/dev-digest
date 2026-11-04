/** Pure helpers for a PR Brief file reference. */
import { middleTruncate } from "@/lib/context-docs";
import { PATH_MAX_CHARS } from "./constants";

/**
 * The visible text of a reference: the middle-truncated path (file name kept,
 * R-72) plus `:<lines>` when there is a line part. `lines` defaults to the
 * single line number.
 */
export function refText(path: string, line: number | null, lines?: string): string {
  const suffix = lines ?? (line != null ? String(line) : null);
  const shown = middleTruncate(path, PATH_MAX_CHARS);
  return suffix ? `${shown}:${suffix}` : shown;
}

/** The full, untruncated form for the `title` tooltip. */
export function refTitle(path: string, line: number | null, lines?: string): string {
  const suffix = lines ?? (line != null ? String(line) : null);
  return suffix ? `${path}:${suffix}` : path;
}
