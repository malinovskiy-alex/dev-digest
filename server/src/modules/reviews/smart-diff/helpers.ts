/**
 * Smart Diff — pure helpers (Ring 1). No async, no I/O, no framework: every
 * function here is computed from its arguments alone.
 *
 * `classifyFile` is the single classifier for a changed file's role. The
 * client never classifies; it consumes `GET /pulls/:id/smart-diff`.
 */
import type { SmartDiff, SmartDiffFile, SmartDiffRole } from '@devdigest/shared';
import {
  BOILERPLATE_ANY_DIRS,
  BOILERPLATE_INFIXES,
  BOILERPLATE_ROOT_DIRS,
  BOILERPLATE_SUFFIXES,
  CLASSIFY_PRECEDENCE,
  DOCS_ANY_DIRS,
  DOCS_PREFIXES,
  DOCS_SUFFIXES,
  LOCKFILE_BASENAMES,
  ROLE_ORDER,
  TEST_ANY_DIRS,
  TEST_ROOT_DIRS,
  TEST_SUFFIXES,
  WIRING_ANY_DIRS,
  WIRING_BASENAMES,
  WIRING_INFIXES,
  WIRING_PREFIXES,
  WIRING_PREFIX_SUFFIX,
} from './constants.js';

/** `\` → `/`, then one leading `./` stripped. */
export function normalizePath(path: string): string {
  const slashed = path.split('\\').join('/');
  return slashed.startsWith('./') ? slashed.slice(2) : slashed;
}

/** A path split into its directory segments and its basename. */
interface PathParts {
  dirs: string[];
  base: string;
}

function splitPath(path: string): PathParts {
  const segments = normalizePath(path).split('/').filter((s) => s.length > 0);
  const base = segments.pop() ?? '';
  return { dirs: segments, base };
}

const endsWithAny = (s: string, list: readonly string[]) => list.some((x) => s.endsWith(x));
const startsWithAny = (s: string, list: readonly string[]) => list.some((x) => s.startsWith(x));
const includesAny = (s: string, list: readonly string[]) => list.some((x) => s.includes(x));
const anyDirIn = (dirs: readonly string[], list: readonly string[]) =>
  dirs.some((d) => list.includes(d));
const firstDirIn = (dirs: readonly string[], list: readonly string[]) =>
  dirs.length > 0 && list.includes(dirs[0]!);

type ClassifiedRole = (typeof CLASSIFY_PRECEDENCE)[number];

const MATCHERS: Record<ClassifiedRole, (p: PathParts) => boolean> = {
  boilerplate: ({ dirs, base }) =>
    LOCKFILE_BASENAMES.includes(base) ||
    endsWithAny(base, BOILERPLATE_SUFFIXES) ||
    includesAny(base, BOILERPLATE_INFIXES) ||
    firstDirIn(dirs, BOILERPLATE_ROOT_DIRS) ||
    anyDirIn(dirs, BOILERPLATE_ANY_DIRS),
  tests: ({ dirs, base }) =>
    endsWithAny(base, TEST_SUFFIXES) ||
    anyDirIn(dirs, TEST_ANY_DIRS) ||
    firstDirIn(dirs, TEST_ROOT_DIRS),
  wiring: ({ dirs, base }) =>
    WIRING_BASENAMES.includes(base) ||
    includesAny(base, WIRING_INFIXES) ||
    startsWithAny(base, WIRING_PREFIXES) ||
    WIRING_PREFIX_SUFFIX.some(([pre, suf]) => base.startsWith(pre) && base.endsWith(suf)) ||
    anyDirIn(dirs, WIRING_ANY_DIRS),
  docs: ({ dirs, base }) => {
    const lower = base.toLowerCase();
    return (
      endsWithAny(lower, DOCS_SUFFIXES) ||
      startsWithAny(lower, DOCS_PREFIXES) ||
      anyDirIn(dirs, DOCS_ANY_DIRS)
    );
  },
};

/**
 * The role of a changed file. Checks `CLASSIFY_PRECEDENCE` in order and
 * returns the first match; anything unmatched is `core`. Linear in the path
 * length — string operations only, no RegExp built from the path.
 */
export function classifyFile(path: string): SmartDiffRole {
  const parts = splitPath(path);
  for (const role of CLASSIFY_PRECEDENCE) {
    if (MATCHERS[role](parts)) return role;
  }
  return 'core';
}

/** The minimum a changed file needs to be grouped. */
export interface SmartDiffInputFile {
  path: string;
  additions: number;
  deletions: number;
}

/** Where a finding points: its file and its first line. */
export interface SmartDiffAnchor {
  file: string;
  start_line: number;
}

/** The PR's latest review as Smart Diff needs it: its id and its anchors. */
export interface SmartDiffLatestReview {
  /** null when the PR has no `kind = 'review'` review; `anchors` is then empty. */
  review_id: string | null;
  anchors: readonly SmartDiffAnchor[];
}

/**
 * Group a PR's files by role. Groups come out in `ROLE_ORDER`, empty ones are
 * omitted, and files keep their input order within a group. `finding_lines`
 * holds the unique, ascending `start_line`s of the latest review's anchors on
 * that file; anchors on a path that is not in `files` are ignored. `review_id`
 * is passed through so the client renders inline findings from the same
 * review the counters were built from.
 */
export function buildSmartDiff(
  files: readonly SmartDiffInputFile[],
  latest: SmartDiffLatestReview,
): SmartDiff {
  const linesByFile = new Map<string, Set<number>>();
  for (const a of latest.anchors) {
    const set = linesByFile.get(a.file) ?? new Set<number>();
    set.add(a.start_line);
    linesByFile.set(a.file, set);
  }

  const byRole = new Map<SmartDiffRole, SmartDiffFile[]>();
  let totalLines = 0;
  for (const f of files) {
    totalLines += f.additions + f.deletions;
    const role = classifyFile(f.path);
    const list = byRole.get(role) ?? [];
    list.push({
      path: f.path,
      additions: f.additions,
      deletions: f.deletions,
      finding_lines: [...(linesByFile.get(f.path) ?? [])].sort((x, y) => x - y),
    });
    byRole.set(role, list);
  }

  const groups = ROLE_ORDER.flatMap((role) => {
    const groupFiles = byRole.get(role);
    return groupFiles && groupFiles.length > 0 ? [{ role, files: groupFiles }] : [];
  });

  return {
    review_id: latest.review_id,
    groups,
    split_suggestion: { too_big: false, total_lines: totalLines, proposed_splits: [] },
  };
}
