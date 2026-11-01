/**
 * Onboarding Tour (L05) — deterministic fact builders. Ring 1: every function
 * is pure, computed from its arguments alone, and every sort has a total
 * tie-break, so equal inputs give deep-equal outputs (AC-23).
 *
 * Nothing here reads a file or runs a command. The service hands in tree paths
 * (from `git ls-tree`) and already-read excerpts; lockfiles and compose files
 * are recognised by NAME only (AC-68, D-7, D-12). A command string is built
 * only from fixed templates, allow-listed script names, fixed env-example file
 * names and directory segments that pass `isSafeDir` (D-44, INV-15).
 */
import { z } from 'zod';
import type { TourFileRow, TourFolder, TourStack, TourTaskKind } from '@devdigest/shared';
import {
  COMPOSE_COMMAND,
  COMPOSE_FILE_NAMES,
  DEFAULT_PM,
  ENV_EXAMPLE_NAMES,
  ENV_NAME_PATTERN,
  EXCERPT_MAX_CHARS,
  EXCLUDED_DIRS,
  EXTENSION_LANGUAGE,
  FRAMEWORK_DEPENDENCIES,
  LOCKFILE_INSTALL,
  MAX_CANDIDATES,
  MAX_CRITICAL_ROWS,
  MAX_ENV_NAMES,
  MAX_FOLDERS,
  MAX_SUB_MANIFESTS,
  OPEN_PR_LIMIT,
  README_PATTERN,
  SAFE_DIR_SEGMENT,
  SCRIPT_ALLOW_LIST,
  TEST_DIR_SEGMENTS,
  TEST_FILE_PATTERN,
  TODO_PATTERN,
  TODO_TEXT_MAX,
} from '../constants.js';

// ---------------------------------------------------------------------------
// Domain shapes
// ---------------------------------------------------------------------------

/** A ranked file as the index reports it (structurally the facade's row). */
export interface IndexedFile {
  path: string;
  rank: number;
  percentile: number;
  importers: number;
}

/** The four `package.json` fields the tour uses. */
export interface ParsedManifest {
  scripts: Record<string, string>;
  deps: string[];
  packageManager: string | null;
  enginesNode: string | null;
}

/** One manifest read at the revision. `dir` is '' for the root. */
export interface ManifestFact {
  dir: string;
  path: string;
  /** The excerpt that reached the prompt (AC-68). */
  text: string;
  parsed: ParsedManifest | null;
}

/** A run command derived from the tree, before the model orders it. */
export interface DerivedCommand {
  id: string;
  command: string;
}

/** A first-task candidate (D-15 … D-18). `id` is what the model refers to. */
export interface TaskCandidate {
  id: string;
  kind: TourTaskKind;
  path: string | null;
  line: number | null;
  pr_number: number | null;
  pr_title: string | null;
  /** TODO text, or the PR author. */
  detail: string | null;
  importers: number | null;
  top_percent: number | null;
}

/** An open-PR row as the repository reads it (D-17). */
export interface OpenPull {
  number: number;
  title: string;
  author: string;
  status: string;
  updatedAt: Date | null;
}

/**
 * Everything collected from git and the index for one revision (D-5). It is
 * memoised per `(repoId, revision, index updatedAt)` (D-33); open PRs are not
 * part of it and are re-read on every request.
 */
export interface TourFacts {
  revision: string;
  treePaths: string[];
  /** Every ranked file — N in the header (D-23). */
  indexed: IndexedFile[];
  /** Top 8 by rank, junk excluded (AC-46, AC-47). */
  readingPaths: string[];
  /** Top 30 by rank, junk excluded — the TODO / missing-tests scan set (D-15). */
  scanPaths: string[];
  chains: string[][];
  endpoints: Array<{ file: string; endpoint: string }>;
  manifests: ManifestFact[];
  readme: { path: string; text: string } | null;
  envExample: { path: string; names: string[] } | null;
  /** TODO + missing-tests candidates, not yet ordered. */
  fileCandidates: TaskCandidate[];
  commands: DerivedCommand[];
  stack: TourStack;
  folders: TourFolder[];
}

// ---------------------------------------------------------------------------
// Small text helpers
// ---------------------------------------------------------------------------

/** Collapse whitespace and newlines to single spaces, cut to `max` with `…`. */
export function oneLine(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** The first `EXCERPT_MAX_CHARS` chars of a file (AC-68). */
export function excerpt(text: string): string {
  return text.length > EXCERPT_MAX_CHARS ? text.slice(0, EXCERPT_MAX_CHARS) : text;
}

/** `max(1, 100 − percentile)`, an integer (D-14). Percentile 100 → 1, 95 → 5. */
export function topPercent(percentile: number): number {
  return Math.max(1, Math.round(100 - percentile));
}

/** Code-unit string order — locale-independent, so it is the same everywhere. */
export function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function basename(path: string): string {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(i + 1) : path;
}

function extension(path: string): string {
  const name = basename(path);
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i).toLowerCase() : '';
}

function joinDir(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}

// ---------------------------------------------------------------------------
// Manifests (D-6)
// ---------------------------------------------------------------------------

const ManifestFields = z.object({
  scripts: z.record(z.string(), z.unknown()).optional(),
  dependencies: z.record(z.string(), z.unknown()).optional(),
  devDependencies: z.record(z.string(), z.unknown()).optional(),
  packageManager: z.unknown().optional(),
  engines: z.record(z.string(), z.unknown()).optional(),
});

/** Parse a whole `package.json` — never the excerpt (F-08). Invalid JSON or shape → `null`. */
export function parseManifest(text: string): ParsedManifest | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const parsed = ManifestFields.safeParse(raw);
  if (!parsed.success) return null;
  const m = parsed.data;
  const scripts: Record<string, string> = {};
  for (const [name, body] of Object.entries(m.scripts ?? {})) {
    if (typeof body === 'string') scripts[name] = body;
  }
  const deps = [
    ...new Set([...Object.keys(m.dependencies ?? {}), ...Object.keys(m.devDependencies ?? {})]),
  ].sort(cmp);
  const node = m.engines?.node;
  return {
    scripts,
    deps,
    packageManager: typeof m.packageManager === 'string' ? m.packageManager : null,
    enginesNode: typeof node === 'string' ? node : null,
  };
}

/**
 * Whether a directory may appear in a command (D-44): every segment matches
 * `SAFE_DIR_SEGMENT` and is neither `.` nor `..`. The root ('') is safe.
 */
export function isSafeDir(dir: string): boolean {
  if (dir === '') return true;
  return dir
    .split('/')
    .every((seg) => seg !== '.' && seg !== '..' && SAFE_DIR_SEGMENT.test(seg));
}

/**
 * At most `MAX_SUB_MANIFESTS` first-level dirs holding a `package.json`,
 * picked by indexed-file count under the dir (desc), ties by dir (asc). Unsafe
 * and excluded dirs are dropped BEFORE the pick, so they never use up a slot.
 */
export function pickSubManifestDirs(treePaths: string[], indexedPaths: string[]): string[] {
  const excluded = new Set<string>(EXCLUDED_DIRS);
  const dirs = new Set<string>();
  for (const p of treePaths) {
    const parts = p.split('/');
    if (parts.length !== 2 || parts[1] !== 'package.json') continue;
    const dir = parts[0]!;
    if (excluded.has(dir) || !isSafeDir(dir)) continue;
    dirs.add(dir);
  }
  const count = new Map<string, number>();
  for (const p of indexedPaths) {
    const i = p.indexOf('/');
    if (i <= 0) continue;
    const dir = p.slice(0, i);
    if (dirs.has(dir)) count.set(dir, (count.get(dir) ?? 0) + 1);
  }
  return [...dirs]
    .sort((a, b) => (count.get(b) ?? 0) - (count.get(a) ?? 0) || cmp(a, b))
    .slice(0, MAX_SUB_MANIFESTS);
}

/** The `package.json` paths to read: the root (if present), then the picked dirs. */
export function manifestPaths(treePaths: string[], indexedPaths: string[]): Array<{ dir: string; path: string }> {
  const tree = new Set(treePaths);
  const out: Array<{ dir: string; path: string }> = [];
  if (tree.has('package.json')) out.push({ dir: '', path: 'package.json' });
  for (const dir of pickSubManifestDirs(treePaths, indexedPaths)) {
    out.push({ dir, path: `${dir}/package.json` });
  }
  return out;
}

function lockfileFor(dir: string, tree: ReadonlySet<string>) {
  return LOCKFILE_INSTALL.find((l) => tree.has(joinDir(dir, l.file))) ?? null;
}

/** The install command of a dir — from its lockfile only, else `null` (D-7). */
export function installCommand(dir: string, treePaths: string[]): string | null {
  return lockfileFor(dir, new Set(treePaths))?.install ?? null;
}

// ---------------------------------------------------------------------------
// Env example, compose, README (D-8)
// ---------------------------------------------------------------------------

/** The first existing env-example file name in `dir`, or `null`. */
export function findEnvExample(dir: string, treePaths: string[]): string | null {
  const tree = new Set(treePaths);
  const hit = ENV_EXAMPLE_NAMES.find((n) => tree.has(joinDir(dir, n)));
  return hit ? joinDir(dir, hit) : null;
}

/** A root compose file (by name), or `null`. It is never read (D-12). */
export function findCompose(treePaths: string[]): string | null {
  const tree = new Set(treePaths);
  return COMPOSE_FILE_NAMES.find((n) => tree.has(n)) ?? null;
}

/** The root README (`/^readme(\.md)?$/i`), first by path asc, or `null`. */
export function findReadme(treePaths: string[]): string | null {
  return (
    treePaths
      .filter((p) => !p.includes('/') && README_PATTERN.test(p))
      .sort(cmp)[0] ?? null
  );
}

/**
 * Variable NAMES of an env-example file, de-duplicated in file order, at most
 * `MAX_ENV_NAMES`. Values are never returned or kept (AC-64).
 */
export function envExampleNames(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const m = ENV_NAME_PATTERN.exec(line);
    const name = m?.[1];
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= MAX_ENV_NAMES) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Run commands (AC-40, AC-45, D-7, D-9, D-44)
// ---------------------------------------------------------------------------

/**
 * Every derived run command, in derivation order (D-9), ids `cmd-1 … cmd-n`:
 * env copies (root, then dirs) → `docker compose up -d` → per manifest dir
 * (root, then the D-6 order): install (if a lockfile), then allow-listed
 * scripts in allow-list order. Unsafe dirs produce nothing (D-44). An empty
 * result means AC-45 applies.
 */
export function deriveCommands(input: {
  treePaths: string[];
  manifests: Array<Pick<ManifestFact, 'dir' | 'parsed'>>;
}): DerivedCommand[] {
  const tree = new Set(input.treePaths);
  const manifests = input.manifests.filter((m) => isSafeDir(m.dir));
  const dirs = [''];
  for (const m of manifests) if (m.dir !== '' && !dirs.includes(m.dir)) dirs.push(m.dir);

  const commands: string[] = [];
  for (const dir of dirs) {
    const name = ENV_EXAMPLE_NAMES.find((n) => tree.has(joinDir(dir, n)));
    if (name) commands.push(`cp ${joinDir(dir, name)} ${joinDir(dir, '.env')}`);
  }
  if (findCompose(input.treePaths)) commands.push(COMPOSE_COMMAND);

  const ordered = [...manifests].sort((a, b) =>
    a.dir === '' ? -1 : b.dir === '' ? 1 : dirs.indexOf(a.dir) - dirs.indexOf(b.dir),
  );
  for (const m of ordered) {
    const prefix = m.dir === '' ? '' : `cd ${m.dir} && `;
    const lock = lockfileFor(m.dir, tree);
    if (lock) commands.push(`${prefix}${lock.install}`);
    const scripts = m.parsed?.scripts ?? {};
    const pm = lock?.pm ?? DEFAULT_PM;
    for (const script of SCRIPT_ALLOW_LIST) {
      if (Object.prototype.hasOwnProperty.call(scripts, script)) {
        commands.push(`${prefix}${pm} run ${script}`);
      }
    }
  }
  return commands.map((command, i) => ({ id: `cmd-${i + 1}`, command }));
}

// ---------------------------------------------------------------------------
// Stack and folders (AC-20, AC-34)
// ---------------------------------------------------------------------------

/** Languages, frameworks and runtime, from indexed paths, manifests and the tree. */
export function detectStack(input: {
  indexedPaths: string[];
  manifests: ManifestFact[];
  treePaths: string[];
}): TourStack {
  const langCount = new Map<string, number>();
  for (const p of input.indexedPaths) {
    const lang = EXTENSION_LANGUAGE[extension(p)];
    if (lang) langCount.set(lang, (langCount.get(lang) ?? 0) + 1);
  }
  const languages = [...langCount.entries()]
    .map(([name, files]) => ({ name, files }))
    .sort((a, b) => b.files - a.files || cmp(a.name, b.name));

  const deps = new Set<string>();
  for (const m of input.manifests) for (const d of m.parsed?.deps ?? []) deps.add(d);
  const frameworks: string[] = [];
  for (const f of FRAMEWORK_DEPENDENCIES) {
    if (deps.has(f.dep) && !frameworks.includes(f.label)) frameworks.push(f.label);
  }

  const runtime: string[] = [];
  if (input.manifests.some((m) => m.parsed)) {
    const engines = input.manifests.find((m) => m.dir === '')?.parsed?.enginesNode;
    runtime.push(engines ? `Node.js ${engines}` : 'Node.js');
  }
  const tree = new Set(input.treePaths);
  const dirs = ['', ...input.manifests.map((m) => m.dir).filter((d) => d !== '')];
  for (const dir of dirs) {
    const lock = lockfileFor(dir, tree);
    if (lock && !runtime.includes(lock.pm)) runtime.push(lock.pm);
  }
  if (findCompose(input.treePaths)) runtime.push('Docker Compose');
  return { languages, frameworks, runtime };
}

/** First path segments of indexed files with counts, count desc then name asc (D-6). */
export function topLevelFolders(indexedPaths: string[]): TourFolder[] {
  const count = new Map<string, number>();
  for (const p of indexedPaths) {
    const i = p.indexOf('/');
    if (i <= 0) continue; // a root-level file is not a folder
    const dir = p.slice(0, i);
    count.set(dir, (count.get(dir) ?? 0) + 1);
  }
  return [...count.entries()]
    .map(([path, files]) => ({ path, files }))
    .sort((a, b) => b.files - a.files || cmp(a.path, b.path))
    .slice(0, MAX_FOLDERS);
}

// ---------------------------------------------------------------------------
// File rows (AC-35, AC-36, AC-48, AC-49)
// ---------------------------------------------------------------------------

function rowFor(path: string, byPath: ReadonlyMap<string, IndexedFile>): TourFileRow {
  const f = byPath.get(path);
  return {
    path,
    reason: null,
    importers: f?.importers ?? 0,
    top_percent: topPercent(f?.percentile ?? 0),
  };
}

/** Reading-path rows from the facade's ranked, junk-filtered top paths (D-14). */
export function readingRows(topPaths: string[], indexedFiles: IndexedFile[]): TourFileRow[] {
  const byPath = new Map(indexedFiles.map((f) => [f.path, f]));
  return topPaths.map((p) => rowFor(p, byPath));
}

/** Critical-path rows: chains flattened in order, first occurrence kept, ≤ 6 (AC-35). */
export function criticalRows(chains: string[][], indexedFiles: IndexedFile[]): TourFileRow[] {
  const byPath = new Map(indexedFiles.map((f) => [f.path, f]));
  const seen = new Set<string>();
  const out: TourFileRow[] = [];
  for (const chain of chains) {
    for (const p of chain) {
      if (seen.has(p)) continue;
      seen.add(p);
      out.push(rowFor(p, byPath));
      if (out.length >= MAX_CRITICAL_ROWS) return out;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Task candidates (AC-52, AC-53, D-15 … D-18)
// ---------------------------------------------------------------------------

/**
 * TODO/FIXME/HACK markers inside comments of one file, 1-based lines (D-15).
 * The file is cut to its excerpt here — the one and only cut (F-15).
 */
export function scanTodos(path: string, text: string): TaskCandidate[] {
  const out: TaskCandidate[] = [];
  const lines = excerpt(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const m = TODO_PATTERN.exec(lines[i]!);
    if (!m) continue;
    const line = i + 1;
    out.push({
      id: `todo:${path}:${line}`,
      kind: 'todo',
      path,
      line,
      pr_number: null,
      pr_title: null,
      detail: oneLine((m[2] ?? '').replace(/\s*\*\/\s*$/, ''), TODO_TEXT_MAX) || null,
      importers: null,
      top_percent: null,
    });
  }
  return out;
}

/** A test file: a `*.test.*` / `*.spec.*` basename, or under a test directory (F-39). */
export function isTestPath(path: string): boolean {
  const segments = path.split('/');
  const name = segments.pop() ?? '';
  return TEST_FILE_PATTERN.test(name) || segments.some((s) => TEST_DIR_SEGMENTS.has(s));
}

/**
 * Scanned files that are not tests themselves and that no test covers (D-16,
 * F-39). A file is covered when a test file imports it directly — the index's
 * import edges (`importers`, "who imports these files") — or, for a test the
 * import graph missed, when a test file anywhere in the tree has its stem
 * (`<stem>.(test|spec).<ext>`). The order of `scanPaths` is kept.
 */
export function missingTestCandidates(
  scanPaths: string[],
  treePaths: string[],
  importers: ReadonlyArray<{ from: string; to: string }> = [],
): TaskCandidate[] {
  const testedStems = new Set<string>();
  for (const p of treePaths) {
    const name = basename(p);
    if (TEST_FILE_PATTERN.test(name)) testedStems.add(name.replace(TEST_FILE_PATTERN, ''));
  }
  const importedByTest = new Set(importers.filter((e) => isTestPath(e.from)).map((e) => e.to));
  const out: TaskCandidate[] = [];
  for (const path of scanPaths) {
    if (isTestPath(path) || importedByTest.has(path)) continue;
    const name = basename(path);
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    if (testedStems.has(stem)) continue;
    out.push({
      id: `missing-tests:${path}`,
      kind: 'missing-tests',
      path,
      line: null,
      pr_number: null,
      pr_title: null,
      detail: null,
      importers: null,
      top_percent: null,
    });
  }
  return out;
}

/** Open PRs (not merged/closed), `updated_at` desc nulls last, number desc, ≤ 50 (D-17). */
export function openPrCandidates(pulls: OpenPull[]): TaskCandidate[] {
  return pulls
    .filter((p) => p.status !== 'merged' && p.status !== 'closed')
    .sort((a, b) => {
      const ta = a.updatedAt?.getTime() ?? null;
      const tb = b.updatedAt?.getTime() ?? null;
      if (ta !== tb) {
        if (ta === null) return 1;
        if (tb === null) return -1;
        return tb - ta;
      }
      return b.number - a.number;
    })
    .slice(0, OPEN_PR_LIMIT)
    .map((p) => ({
      id: `open-pr:${p.number}`,
      kind: 'open-pr' as const,
      path: null,
      line: null,
      pr_number: p.number,
      pr_title: p.title,
      detail: p.author,
      importers: null,
      top_percent: null,
    }));
}

const KIND_ORDER: Record<TourTaskKind, number> = { todo: 0, 'missing-tests': 1, 'open-pr': 2 };

/**
 * File candidates by the file's ranked index (highest rank first), within a
 * file `todo` before `missing-tests` then line asc; then open PRs in their
 * order; the first `MAX_CANDIDATES` (D-18). Index rows fill importers/top%.
 */
export function orderCandidates(
  fileCandidates: TaskCandidate[],
  prCandidates: TaskCandidate[],
  rankIndex: ReadonlyMap<string, number>,
  indexedFiles: IndexedFile[] = [],
): TaskCandidate[] {
  const byPath = new Map(indexedFiles.map((f) => [f.path, f]));
  const idx = (p: string | null) => (p !== null ? (rankIndex.get(p) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER);
  const files = [...fileCandidates]
    .sort(
      (a, b) =>
        idx(a.path) - idx(b.path) ||
        cmp(a.path ?? '', b.path ?? '') ||
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
        (a.line ?? 0) - (b.line ?? 0),
    )
    .map((c) => {
      const f = c.path ? byPath.get(c.path) : undefined;
      return f ? { ...c, importers: f.importers, top_percent: topPercent(f.percentile) } : c;
    });
  return [...files, ...prCandidates].slice(0, MAX_CANDIDATES);
}
