/** Pure helpers for SmartDiffGroup. */
import type { SmartDiffGroup } from "@devdigest/shared";

/** How many files in the group have at least one finding line (S3). */
export function filesWithFindings(group: SmartDiffGroup): number {
  return group.files.filter((f) => f.finding_lines.length > 0).length;
}
