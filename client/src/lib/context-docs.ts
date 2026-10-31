/* lib/context-docs.ts — pure helpers behind the agent and skill "Context" tabs
   (and the Project Context page's path display). No React, no fetch: every
   value here is derived during render from the server's listing + links. */
import type { ContextDoc, ContextDocLink, ContextDocLinkInput, InheritedContextDoc } from "@devdigest/shared";

/** One row of a Context tab's document list. */
export interface DocRow {
  /** `direct` rows can be checked/reordered; `inherited` rows come through a skill. */
  kind: "direct" | "inherited";
  path: string;
  /** The listing entry; absent when the path is not in the active repo's list. */
  doc?: ContextDoc;
  /** Checked. Always true for an inherited row. */
  enabled: boolean;
  /** Has a stored position (the stored block). Unstored direct rows are plain source docs. */
  stored: boolean;
  /** The path is not in the active repo's listing ("file not found"). */
  missing: boolean;
  /** Names of active skills that also put this path in the prompt. */
  viaSkills: string[];
}

/**
 * The list order (D-8): stored rows in their saved order (checked and parked
 * alike), then docs the agent only inherits through a skill, then every other
 * listed doc alphabetically. A path appears in exactly one row.
 */
export function buildDocRows(
  docs: ContextDoc[],
  attached: ContextDocLink[],
  inherited: InheritedContextDoc[] = [],
): DocRow[] {
  const byPath = new Map(docs.map((d) => [d.path, d]));
  const via = new Map<string, string[]>();
  for (const i of inherited) {
    const names = via.get(i.path) ?? [];
    if (!names.includes(i.skill_name)) names.push(i.skill_name);
    via.set(i.path, names);
  }

  const rows: DocRow[] = [];
  const seen = new Set<string>();
  const stored = [...attached].sort((a, b) => a.order - b.order);
  for (const link of stored) {
    if (seen.has(link.path)) continue;
    seen.add(link.path);
    const doc = byPath.get(link.path);
    rows.push({
      kind: "direct",
      path: link.path,
      doc,
      enabled: link.enabled,
      stored: true,
      missing: !doc,
      viaSkills: via.get(link.path) ?? [],
    });
  }
  for (const i of inherited) {
    if (seen.has(i.path)) continue;
    seen.add(i.path);
    const doc = byPath.get(i.path);
    rows.push({
      kind: "inherited",
      path: i.path,
      doc,
      enabled: true,
      stored: false,
      missing: !doc,
      viaSkills: via.get(i.path) ?? [],
    });
  }
  const rest = docs.filter((d) => !seen.has(d.path)).sort((a, b) => comparePaths(a.path, b.path));
  for (const doc of rest) {
    rows.push({ kind: "direct", path: doc.path, doc, enabled: false, stored: false, missing: false, viaSkills: [] });
  }
  return rows;
}

function comparePaths(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Case-insensitive substring match on the path (R-25). An empty query matches all. */
export function matchesPathFilter(path: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === "" || path.toLowerCase().includes(q);
}

/** Index range `[start, end)` of the stored block — the only rows that reorder. */
function storedRange(rows: DocRow[]): [number, number] {
  const end = rows.findIndex((r) => !r.stored);
  return [0, end === -1 ? rows.length : end];
}

/**
 * Move the row at `from` to `to` (indices into the FULL row array, never a
 * filtered view). Only stored rows move, and only inside the stored block.
 */
export function moveRow(rows: DocRow[], from: number, to: number): DocRow[] {
  const [start, end] = storedRange(rows);
  if (from < start || from >= end) return rows;
  const target = Math.min(Math.max(to, start), end - 1);
  if (target === from) return rows;
  const next = [...rows];
  const [row] = next.splice(from, 1);
  next.splice(target, 0, row!);
  return next;
}

/**
 * Check or uncheck one direct row.
 * - Checking an unstored doc appends it to the END of the stored block (D-8).
 * - Unchecking a stored row parks it in place (R-22) — unless its file is gone,
 *   in which case the row is removed: a parked row for a missing file is
 *   useless (D-10).
 */
export function toggleRow(rows: DocRow[], path: string): DocRow[] {
  const index = rows.findIndex((r) => r.path === path);
  const row = rows[index];
  if (!row || row.kind !== "direct") return rows;

  if (row.stored) {
    if (row.enabled && row.missing) return rows.filter((_, i) => i !== index);
    return rows.map((r, i) => (i === index ? { ...r, enabled: !r.enabled } : r));
  }

  const without = rows.filter((_, i) => i !== index);
  const [, end] = storedRange(without);
  const next = [...without];
  next.splice(end, 0, { ...row, enabled: true, stored: true });
  return next;
}

/**
 * What the PUT posts: EVERY stored row in order, with its flag — including
 * rows whose path is not in the active repo's listing. Attachments are paths,
 * resolved against whichever repo an agent reviews: a path absent here may be
 * present in another repo, past the listing cap, or in a repo not cloned yet.
 * So a save never drops an attachment; the only way a row leaves the list is
 * the user detaching it (`toggleRow` on a missing, checked row — D-10).
 */
export function toEntries(rows: DocRow[]): ContextDocLinkInput[] {
  return rows
    .filter((r) => r.kind === "direct" && r.stored)
    .map((r) => ({ path: r.path, enabled: r.enabled }));
}

/** X in "X of Y attached" (D-9): checked stored rows whose doc is in the listing. */
export function attachedCount(rows: DocRow[]): number {
  return rows.filter((r) => r.kind === "direct" && r.stored && r.enabled && !r.missing).length;
}

/** Y in "X of Y attached" (D-9): the docs of the active repo's listing. */
export function sourceCount(rows: DocRow[]): number {
  return rows.filter((r) => r.doc !== undefined).length;
}

/** True when the row's document reaches the prompt — checked, inherited, or via a skill. */
export function inPrompt(row: DocRow): boolean {
  return row.kind === "inherited" || row.enabled || row.viaSkills.length > 0;
}

/**
 * "≈ N tokens" (R-26, R-68, R-69): every document that reaches the prompt,
 * counted once per path, at its server-computed (truncation-aware) weight. A
 * missing file counts 0. Taken from the FULL row array, never a filtered view.
 */
export function promptTokenTotal(rows: DocRow[]): number {
  const seen = new Set<string>();
  let total = 0;
  for (const row of rows) {
    if (!inPrompt(row) || seen.has(row.path)) continue;
    seen.add(row.path);
    total += row.doc?.approx_tokens ?? 0;
  }
  return total;
}

/**
 * Shorten a path to at most `max` characters by cutting its middle, keeping
 * the start and the file name (UX-03). Render the full path in `title`.
 */
export function middleTruncate(path: string, max: number): string {
  if (path.length <= max || max < 2) return path;
  const slash = path.lastIndexOf("/");
  const tail = slash >= 0 ? path.slice(slash) : path;
  const room = max - 1; // one char for the ellipsis
  if (tail.length >= room) return `…${path.slice(path.length - room)}`;
  return `${path.slice(0, room - tail.length)}…${tail}`;
}
