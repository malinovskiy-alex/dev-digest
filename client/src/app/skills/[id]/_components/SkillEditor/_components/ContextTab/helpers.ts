import type { DocRow } from "@/lib/context-docs";

/** Heading of the section the documents land under in a review prompt. */
export const PROJECT_CONTEXT_HEADING = "## Project context";

/**
 * Checked attachments that the active repo actually has. A checked path the
 * listing does not contain is skipped by a run on this repo (`not_found`), so
 * neither the count nor the preview should promise it.
 */
function contributing(rows: DocRow[]): DocRow[] {
  return rows.filter((r) => r.kind === "direct" && r.stored && r.enabled && !r.missing);
}

/**
 * The "Serializes as" preview (R-39, D-OQ3): the section heading, then one
 * `- <path>` line per checked attached document present in the active repo,
 * in saved order. Paths only — the document text is never shown here. `null`
 * when nothing contributes.
 */
export function serializePreview(rows: DocRow[]): string | null {
  const paths = contributing(rows).map((r) => r.path);
  if (paths.length === 0) return null;
  return [PROJECT_CONTEXT_HEADING, ...paths.map((p) => `- ${p}`)].join("\n");
}

/** "{N} attached": the skill's checked documents present in the active repo. */
export function checkedCount(rows: DocRow[]): number {
  return contributing(rows).length;
}
