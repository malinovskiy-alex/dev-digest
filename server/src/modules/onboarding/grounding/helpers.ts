/**
 * Onboarding Tour (L05) — the gate between the model's answer and the stored
 * tour. Ring 1, pure.
 *
 * The model never decides a path, a command or a task target. Rows, commands
 * and tasks keep the deterministic facts' order and content; the model may
 * only attach text to them (a reason, a why, a comment, a title), and only
 * where it names something the facts already contain (AC-33, AC-36, AC-41,
 * AC-50, AC-54, AC-61, AC-88). Free prose is scrubbed of unknown paths and of
 * every external link (D-26).
 *
 * Error classification duck-types the platform errors by `name`/`code` so this
 * file imports nothing outside the module (INV-8).
 */
import type {
  TourCommand,
  TourComponent,
  TourComponentKind,
  TourConnection,
  TourFailureCode,
  TourFileRow,
  TourTask,
} from '@devdigest/shared';
import {
  COMMENT_MAX,
  FAILURE_MESSAGE_MAX,
  INVALID_OUTPUT_MESSAGE,
  LABEL_MAX,
  MAX_COMPONENTS,
  MAX_CONNECTIONS,
  MAX_TASKS,
  MIN_MODEL_TASKS,
  ONE_LINE_MAX,
} from '../constants.js';
import { oneLine, type DerivedCommand, type TaskCandidate } from '../facts/helpers.js';

// ---------------------------------------------------------------------------
// Known paths (D-26)
// ---------------------------------------------------------------------------

/**
 * K = tree paths ∪ indexed paths ∪ every directory prefix of those, each
 * prefix with and without a trailing `/`. Used for the prose scrub only.
 */
export function buildKnownSet(input: { treePaths: string[]; indexedPaths: string[] }): Set<string> {
  const known = new Set<string>();
  for (const p of [...input.treePaths, ...input.indexedPaths]) {
    known.add(p);
    const parts = p.split('/');
    for (let i = 1; i < parts.length; i += 1) {
      const dir = parts.slice(0, i).join('/');
      known.add(dir);
      known.add(`${dir}/`);
    }
  }
  return known;
}

function normRef(ref: string): string {
  return ref.trim().toLowerCase().replace(/\/+$/, '');
}

/**
 * The diagram's reference set (D-11, AC-33): indexed file paths ∪ top-level
 * folder names ∪ dependency names of the manifests read — lower-cased. Not the
 * tree, and never the compose file.
 */
export function buildRefSet(input: {
  indexedPaths: string[];
  folders: string[];
  deps: string[];
}): Set<string> {
  return new Set([...input.indexedPaths, ...input.folders, ...input.deps].map(normRef));
}

// ---------------------------------------------------------------------------
// Diagram (D-11, AC-33, AC-85)
// ---------------------------------------------------------------------------

export interface ModelComponent {
  id: string;
  label: string;
  kind: TourComponentKind;
  ref: string;
}

/**
 * Keep a component iff its `ref` is in `refs`; first of a duplicate id wins;
 * ≤ 12 components, then ≤ 24 connections between survivors (no self-loops, no
 * duplicates). Fewer than 2 components or 0 connections → nothing (AC-85).
 */
export function groundComponents(
  components: ModelComponent[],
  connections: TourConnection[],
  refs: ReadonlySet<string>,
): { components: TourComponent[]; connections: TourConnection[] } {
  const kept: TourComponent[] = [];
  const ids = new Set<string>();
  for (const c of components) {
    if (kept.length >= MAX_COMPONENTS) break;
    const id = c.id.trim();
    if (!id || ids.has(id)) continue;
    if (!refs.has(normRef(c.ref))) continue;
    ids.add(id);
    kept.push({ id, label: oneLine(c.label, LABEL_MAX) || id, kind: c.kind });
  }
  const edges: TourConnection[] = [];
  const seen = new Set<string>();
  for (const e of connections) {
    if (edges.length >= MAX_CONNECTIONS) break;
    const from = e.from.trim();
    const to = e.to.trim();
    if (from === to || !ids.has(from) || !ids.has(to)) continue;
    const key = JSON.stringify([from, to]);
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from, to });
  }
  if (kept.length < 2 || edges.length === 0) return { components: [], connections: [] };
  return { components: kept, connections: edges };
}

// ---------------------------------------------------------------------------
// Row reasons (AC-36, AC-49, AC-50, D-13)
// ---------------------------------------------------------------------------

/**
 * Attach model text to deterministic rows. Order and set always stay the
 * rows'. `ordered: false` (critical paths): an entry for a row's path fills
 * that row's reason (first wins), other entries are ignored. `ordered: true`
 * (reading path, D-13): entries are walked in model order and one is accepted
 * only if its row index is greater than the last accepted one's.
 */
export function mergeReasons(
  rows: TourFileRow[],
  entries: Array<{ path: string; text: string }>,
  opts: { ordered: boolean },
): TourFileRow[] {
  const index = new Map(rows.map((r, i) => [r.path, i]));
  const out = rows.map((r) => ({ ...r }));
  const filled = new Set<number>();
  let last = -1;
  for (const e of entries) {
    const i = index.get(e.path);
    if (i === undefined) continue;
    if (opts.ordered) {
      if (i <= last) continue;
      last = i;
    } else if (filled.has(i)) {
      continue;
    }
    filled.add(i);
    out[i]!.reason = oneLine(e.text, ONE_LINE_MAX) || null;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Commands (AC-41, AC-88, D-10)
// ---------------------------------------------------------------------------

/**
 * Model-ordered known ids first (first occurrence only, unknown ids dropped),
 * then every derived command the model left out, in derivation order with
 * `comment: null`. The command text is always the derived one.
 */
export function orderCommands(
  derived: DerivedCommand[],
  modelCommands: Array<{ id: string; comment: string }>,
): TourCommand[] {
  const byId = new Map(derived.map((d) => [d.id, d]));
  const used = new Set<string>();
  const rows: Array<{ command: string; comment: string | null }> = [];
  for (const m of modelCommands) {
    const d = byId.get(m.id.trim());
    if (!d || used.has(d.id)) continue;
    used.add(d.id);
    rows.push({ command: d.command, comment: oneLine(m.comment, COMMENT_MAX) || null });
  }
  for (const d of derived) {
    if (!used.has(d.id)) rows.push({ command: d.command, comment: null });
  }
  return rows.map((r, i) => ({ step: i + 1, ...r }));
}

// ---------------------------------------------------------------------------
// Tasks (AC-54, AC-55, AC-56, D-19)
// ---------------------------------------------------------------------------

function toTask(
  c: TaskCandidate,
  source: 'model' | 'fallback',
  title: string | null,
  reason: string | null,
): TourTask {
  return {
    candidate_id: c.id,
    kind: c.kind,
    source,
    title,
    reason,
    path: c.path,
    line: c.line,
    pr_number: c.pr_number,
    pr_title: c.pr_title,
    detail: c.detail,
    importers: c.importers,
    top_percent: c.top_percent,
  };
}

/** The first `MAX_TASKS` candidates as fallback tasks; the client words them (D-19). */
export function fallbackTasks(candidates: TaskCandidate[]): TourTask[] {
  return candidates.slice(0, MAX_TASKS).map((c) => toTask(c, 'fallback', null, null));
}

/**
 * Keep a model task iff its `candidate_id` is a known candidate not used by an
 * earlier kept task; at most 5. Fewer than 3 → the fallback tasks (AC-56).
 * Path, line and PR always come from the candidate, never from model text.
 */
export function groundTasks(
  candidates: TaskCandidate[],
  modelTasks: Array<{ candidate_id: string; title: string; reason: string }>,
): TourTask[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const used = new Set<string>();
  const kept: TourTask[] = [];
  for (const t of modelTasks) {
    if (kept.length >= MAX_TASKS) break;
    const c = byId.get((t.candidate_id ?? '').trim());
    if (!c || used.has(c.id)) continue;
    used.add(c.id);
    kept.push(
      toTask(c, 'model', oneLine(t.title, ONE_LINE_MAX) || null, oneLine(t.reason, ONE_LINE_MAX) || null),
    );
  }
  return kept.length < MIN_MODEL_TASKS ? fallbackTasks(candidates) : kept;
}

// ---------------------------------------------------------------------------
// Prose scrub (AC-31, AC-61, D-26)
// ---------------------------------------------------------------------------

/** Extensions that make a code span "look like a path". */
const PATH_EXTENSIONS =
  /\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdx|ya?ml|toml|lock|txt|sql|css|scss|html|sh|py|go|rs|java|rb|env|example)$/i;

/** A fenced block or an inline code span. */
const CODE = /(```[\s\S]*?```|`[^`\n]+`)/g;
/** A markdown link or image: `[text](href "title")` / `![alt](src)`. */
const LINK = /(!?)\[([^\]\n]*)\]\(\s*([^)\s]*)(?:\s+"[^"\n]*")?\s*\)/g;
/**
 * Anything GFM would turn into a link on its own (F-17): an angle-bracket
 * autolink of any scheme (`<mailto:…>`), a bare or angle-bracketed web URL, a
 * `www.` autolink, and an email autolink.
 */
const BARE_URL =
  /<[a-z][a-z0-9+.-]{1,31}:[^\s<>]*>|<?\b(?:https?:\/\/|www\.)[^\s<>()`]+>?|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+\b/gi;
/**
 * A link reference definition (`[a]: https://…`, destination possibly on the
 * next line). It is dropped, so a reference-style link `[t][a]` / `[a]` has no
 * target and renders as its literal text (F-17). Footnotes (`[^1]:`) are kept.
 */
const LINK_DEFINITION = /^ {0,3}\[(?!\^)[^\]\n]+\]:[ \t]*(?:\n[ \t]*)?\S[^\n]*(?:\n|$)/gm;
/** A run of path characters, preceded by a boundary. */
const PATH_TOKEN = /(^|[\s(\[{"'])([A-Za-z0-9_.\-/]+)/g;

function looksLikePath(s: string): boolean {
  if (/\s/.test(s) || s.startsWith('/') || s.startsWith('@') || s.includes('://')) return false;
  return s.includes('/') || PATH_EXTENSIONS.test(s);
}

function wrapKnownPaths(text: string, known: ReadonlySet<string>): string {
  return text.replace(PATH_TOKEN, (whole, pre: string, token: string) => {
    const core = token.replace(/[.,:;!?]+$/, '');
    const rest = token.slice(core.length);
    if (!core || !(core.includes('/') || PATH_EXTENSIONS.test(core))) return whole;
    if (!known.has(core)) return whole;
    return `${pre}\`${core}\`${rest}`;
  });
}

/** Text outside code: links first (kept only when relative and known), then URLs and paths. */
function scrubText(raw: string, known: ReadonlySet<string>): string {
  const text = raw.replace(LINK_DEFINITION, '');
  let out = '';
  let at = 0;
  for (const m of text.matchAll(LINK)) {
    const start = m.index ?? 0;
    out += scrubPlain(text.slice(at, start), known);
    const label = m[2] ?? '';
    const href = (m[3] ?? '').trim();
    const relative = href !== '' && !/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('//');
    const target = href.replace(/^\.\//, '').replace(/#.*$/, '');
    if (m[1] === '' && relative && (href.startsWith('#') || known.has(target))) {
      out += m[0];
    } else {
      // an external, unknown or image link becomes its text (D-26 (2), (3))
      out += scrubPlain(label, known);
    }
    at = start + m[0].length;
  }
  return out + scrubPlain(text.slice(at), known);
}

function scrubPlain(text: string, known: ReadonlySet<string>): string {
  // A bare web URL would be auto-linked by GFM: render it as code, not a link.
  const parts = text.split(BARE_URL);
  const urls = text.match(BARE_URL) ?? [];
  let out = '';
  parts.forEach((p, i) => {
    out += wrapKnownPaths(p, known);
    const url = urls[i]?.replace(/^<|>$/g, '');
    if (url) {
      const core = url.replace(/[.,:;!?]+$/, '');
      out += `\`${core}\`${url.slice(core.length)}`;
    }
  });
  return out;
}

/**
 * Scrub model prose (D-26): a path-like code span not in K is removed; a link
 * whose href is external or unknown becomes its text; a link reference
 * definition is dropped; a bare URL, `www.`, email or `<scheme:…>` autolink
 * becomes code;
 * a known path outside code is wrapped in backticks. It never strips `_` and
 * never parses or emits HTML.
 */
export function scrubProse(prose: string, known: ReadonlySet<string>): string {
  let out = '';
  let at = 0;
  for (const m of prose.matchAll(CODE)) {
    const start = m.index ?? 0;
    out += scrubText(prose.slice(at, start), known);
    const span = m[0];
    if (span.startsWith('```')) {
      out += span;
    } else {
      const inner = span.slice(1, -1).trim();
      if (!(looksLikePath(inner) && !known.has(inner) && !known.has(inner.replace(/^\.\//, '')))) {
        out += span;
      } else {
        out = out.replace(/[ \t]+$/, ''); // no double space where the span was
      }
    }
    at = start + span.length;
  }
  out += scrubText(prose.slice(at), known);
  return out.trim();
}

// ---------------------------------------------------------------------------
// Failure classification (AC-72, D-20)
// ---------------------------------------------------------------------------

/**
 * `ConfigError` → `no_api_key`; `TimeoutError` → `timeout`; a schema
 * validation failure → `invalid_output` with the fixed message; anything else
 * → `provider_error` with the error message, ≤ 300 chars.
 */
export function classifyGenerationError(err: unknown): { code: TourFailureCode; message: string } {
  const e = err as { name?: unknown; code?: unknown; message?: unknown } | null;
  const message = typeof e?.message === 'string' ? e.message : String(err);
  if (e?.code === 'config_error') return { code: 'no_api_key', message: oneLine(message, FAILURE_MESSAGE_MAX) };
  if (e?.name === 'TimeoutError') return { code: 'timeout', message: oneLine(message, FAILURE_MESSAGE_MAX) };
  if (/failed schema|schema validation/i.test(message)) {
    return { code: 'invalid_output', message: INVALID_OUTPUT_MESSAGE };
  }
  return { code: 'provider_error', message: oneLine(message, FAILURE_MESSAGE_MAX) || 'unknown error' };
}
