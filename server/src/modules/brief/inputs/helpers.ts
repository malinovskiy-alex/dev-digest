/**
 * PR Brief (L05) — input collection, the pure part (Ring 1). Computed from
 * arguments alone: no async, no I/O. The service reads the facts; these
 * functions shape them into the deterministic input of the one model call.
 *
 * INV-9: `changedLineRanges` is the ONLY reader of patch text in the module,
 * and it returns numbers. No diff text ever reaches the model.
 */
import type { BlastRadius, BriefInput, BriefMissingInput, SmartDiffRole } from '@devdigest/shared';
import { ISSUE_BODY_MAX_CHARS } from '../constants.js';
import type { BriefCaller, BriefPrFile, DiffRow, GroundingContext } from '../types.js';

/** Code-unit order — total and locale-independent (D-16, as `blast/helpers.ts`). */
export function comparePaths(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * `text.slice(0, end)` that never ends on the first half of a surrogate pair:
 * a lone surrogate is not valid UTF-8 once serialised, and a provider rejects
 * the request (F-15). Drops that half, so the cut stays within `end`.
 */
export function sliceWhole(text: string, end: number): string {
  const cut = text.slice(0, end);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

// ---------------------------------------------------------------- diff stats

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/**
 * The maximal runs of consecutive ADDED new-side line numbers of one file's
 * patch (D-13), e.g. `[[12, 18], [40, 52]]`. Context lines advance the
 * new-side counter but are not "changed"; deletions do not advance it. A file
 * with no patch, or with no added line (pure deletion, binary), has no ranges.
 */
export function changedLineRanges(patch: string | null): Array<[number, number]> {
  if (!patch) return [];
  const ranges: Array<[number, number]> = [];
  let newLine = 0;
  let inHunk = false;
  for (const raw of patch.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    const header = HUNK_HEADER.exec(line);
    if (header) {
      newLine = Number(header[1]);
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    const mark = line[0];
    if (mark === '+') {
      const last = ranges[ranges.length - 1];
      if (last && last[1] === newLine - 1) last[1] = newLine;
      else ranges.push([newLine, newLine]);
      newLine += 1;
    } else if (mark === '-' || mark === '\\') {
      // a removed line, or "\ No newline at end of file": no new-side line
    } else {
      // context (' ') — or a blank context line whose leading space was lost
      newLine += 1;
    }
  }
  return ranges;
}

/** `'12-18, 40-52'` (a one-line run is `'40'`), or `'none'`. */
export function formatRanges(ranges: ReadonlyArray<readonly [number, number]>): string {
  if (ranges.length === 0) return 'none';
  return ranges.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(', ');
}

/** One row per changed file, path asc whatever the input order (D-12, D-16). */
export function toDiffRows(files: BriefPrFile[], roleOf: (path: string) => SmartDiffRole): DiffRow[] {
  return [...files]
    .sort((a, b) => comparePaths(a.path, b.path))
    .map((f) => ({
      path: f.path,
      role: roleOf(f.path),
      additions: f.additions,
      deletions: f.deletions,
      ranges: changedLineRanges(f.patch),
    }));
}

// ---------------------------------------------------------------- linked issue

/**
 * Same-repo GitHub issues the PR closes — ONLY with a closing keyword. A COPY
 * of `parseClosingIssues` in `reviews/intent/sources.ts:76` (D-14): the brief
 * may not import the reviews module (`no-cross-module`). A server-unit parity
 * test runs both over the same fixtures; change them together.
 */
export function parseClosingIssues(text: string): number[] {
  const out: number[] = [];
  const re = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b\s*:?\s+#(\d{1,7})\b/gi;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1]);
    if (n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

/** The issue body as it enters the input: at most `ISSUE_BODY_MAX_CHARS` (R-64). */
export function cutIssueBody(body: string | null | undefined): string {
  return sliceWhole((body ?? '').replace(/\r\n/g, '\n').trim(), ISSUE_BODY_MAX_CHARS);
}

// ---------------------------------------------------------------- description

/** `pull.body` with CRLF normalised and trimmed; '' when absent (D-12). */
export function normalizeDescription(body: string | null | undefined): string {
  return (body ?? '').replace(/\r\n/g, '\n').trim();
}

// ---------------------------------------------------------------- specs

/**
 * The union of every enabled agent's attached documents — its own and its
 * skills' — de-duplicated, path asc (D-15, R-65).
 */
export function unionSpecPaths(
  agentPaths: string[][],
  skillGroups: Array<Array<{ paths: string[] }>>,
): string[] {
  const all = new Set<string>();
  for (const paths of agentPaths) for (const p of paths) all.add(p);
  for (const groups of skillGroups) for (const g of groups) for (const p of g.paths) all.add(p);
  return [...all].sort(comparePaths);
}

// ---------------------------------------------------------------- blast

/** Every caller of the blast map, in blast order (`downstream[i].callers[j]`). */
export function flattenCallers(blast: BlastRadius | null): BriefCaller[] {
  if (!blast) return [];
  return blast.downstream.flatMap((d) => d.callers.map((c) => ({ name: c.name, file: c.file, line: c.line })));
}

/** Changed-symbol files and caller files of the full blast map (D-18). */
export function blastPaths(blast: BlastRadius | null): Set<string> {
  const out = new Set<string>();
  if (!blast) return out;
  for (const s of blast.changed_symbols) out.add(s.file);
  for (const d of blast.downstream) for (const c of d.callers) out.add(c.file);
  return out;
}

/** Caller lines per file of the full blast map, unique and ascending (D-13). */
export function callerLinesByFile(blast: BlastRadius | null): Map<string, number[]> {
  const sets = new Map<string, Set<number>>();
  if (blast) {
    for (const d of blast.downstream) {
      for (const c of d.callers) {
        if (!Number.isInteger(c.line) || c.line < 1) continue;
        let s = sets.get(c.file);
        if (!s) sets.set(c.file, (s = new Set()));
        s.add(c.line);
      }
    }
  }
  return new Map([...sets].map(([file, lines]) => [file, [...lines].sort((a, b) => a - b)]));
}

/**
 * What grounding checks the answer against (D-18): every PR row (taken BEFORE
 * the budget trims any) and the FULL blast map — a caller trimmed from the
 * input is still a valid reference.
 */
export function groundingContext(rows: DiffRow[], blast: BlastRadius | null): GroundingContext {
  return {
    prPaths: new Set(rows.map((r) => r.path)),
    ranges: new Map(rows.map((r) => [r.path, r.ranges])),
    callerLines: callerLinesByFile(blast),
    blastPaths: blastPaths(blast),
  };
}

// ---------------------------------------------------------------- missing inputs

/** Fixed listing order of missing inputs (D-16). */
const MISSING_ORDER: readonly BriefInput[] = ['intent', 'blast', 'diff_stats', 'description', 'issue', 'specs'];

export function missingInput(input: BriefInput, reason: string): BriefMissingInput {
  return { input, reason };
}

/** No stored intent → `not_derived` (D-17). */
export function intentMissing(intent: unknown | null): BriefMissingInput | null {
  return intent ? null : missingInput('intent', 'not_derived');
}

/**
 * D-17, R-29: a degraded map is missing — `no_index` for `no_data`, else
 * `degraded:<reason>`; a read that threw is `degraded:error`. A full index
 * with zero callers is NOT missing.
 */
export function blastMissing(blast: BlastRadius | 'error'): BriefMissingInput | null {
  if (blast === 'error') return missingInput('blast', 'degraded:error');
  if (!blast.degraded) return null;
  if (blast.reason === 'no_data') return missingInput('blast', 'no_index');
  return missingInput('blast', `degraded:${blast.reason ?? 'unknown'}`);
}

/** No changed-file rows → `no_files` (D-17). */
export function diffMissing(rows: DiffRow[]): BriefMissingInput | null {
  return rows.length === 0 ? missingInput('diff_stats', 'no_files') : null;
}

/** A blank description → `empty` (D-17). */
export function descriptionMissing(description: string): BriefMissingInput | null {
  return description === '' ? missingInput('description', 'empty') : null;
}

/**
 * D-15, D-17: union empty → `none_attached`; nothing resolved because the repo
 * is not cloned → `not_cloned`; nothing resolved and ≥ 1 document unreadable
 * or not found → `read_error`. A partial resolve is not missing.
 */
export function specsMissing(
  union: string[],
  resolved: { docs: unknown[]; skipped: Array<{ reason: string }> },
): BriefMissingInput | null {
  if (union.length === 0) return missingInput('specs', 'none_attached');
  if (resolved.docs.length > 0) return null;
  if (resolved.skipped.some((s) => s.reason === 'not_cloned')) return missingInput('specs', 'not_cloned');
  if (resolved.skipped.some((s) => s.reason === 'read_error' || s.reason === 'not_found')) {
    return missingInput('specs', 'read_error');
  }
  return null;
}

/** Drops the nulls and sorts into the fixed order (D-16). */
export function orderMissing(list: Array<BriefMissingInput | null>): BriefMissingInput[] {
  return list
    .filter((m): m is BriefMissingInput => m !== null)
    .sort((a, b) => MISSING_ORDER.indexOf(a.input) - MISSING_ORDER.indexOf(b.input));
}
