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
  RAW_EXCERPT_LOG_MAX,
  ZOD_ISSUES_LOG_MAX,
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
 * autolink of any scheme (`<mailto:…>`), a bare web URL, a `www.` autolink,
 * and an email autolink. Best effort only: the client renders every href of
 * the tour prose as inert text (F-29).
 */
const BARE_URL =
  /<[a-z][a-z0-9+.-]{1,31}:[^\s<>]*>|\b(?:https?:\/\/|www\.)[^\s<>()`]+|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+\b/gi;
/** An angle-bracket autolink: both brackets belong to the one match (F-31). */
const ANGLE_AUTOLINK = /^<[\s\S]*>$/;
/**
 * GFM's trailing-punctuation rule for an autolink literal: these characters at
 * the end are not part of the link, so they stay outside the code span (F-31).
 */
const URL_TRAILING_PUNCTUATION = /[!"'),.:;?\]}*_~]+$/;
/** A link title — `"…"`, `'…'` or `(…)` — which may span lines but not a blank one. */
const LINK_TITLE =
  /(?:"(?:[^"\n]|\n(?![ \t]*\n))*"|'(?:[^'\n]|\n(?![ \t]*\n))*'|\((?:[^()\n]|\n(?![ \t]*\n))*\))/.source;
/**
 * A link reference definition as CommonMark parses it (`[a]: https://…`): at
 * most 3 spaces of indent, a non-blank label, `:`, a destination (possibly on
 * the next line), an optional title, then the end of the line. A footnote
 * (`[^1]:`) is not one. Group 1 is the indent, so the `[` after it can be
 * escaped. `[TODO]: fix this later` is not a definition (text after the
 * destination that is not a title) and is left alone.
 */
const LINK_DEFINITION = new RegExp(
  /^( {0,3})\[(?!\^)(?=[^\]\n]*\S)[^[\]\n]+\]:[ \t]*\n?[ \t]*(?:<[^<>\n]*>|[^\s<]\S*)/.source +
    `(?:(?:[ \\t]+|[ \\t]*\\n[ \\t]*)${LINK_TITLE})?[ \\t]*$`,
  'gm',
);
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

function isLineStart(text: string, offset: number): boolean {
  return offset === 0 || text[offset - 1] === '\n';
}

/**
 * Neutralises each link reference definition by inserting `\` before its `[`
 * (F-30). Insertion only, never a deletion: the line renders as its own text,
 * and a reference-style link `[t][a]` / `[a]` has no target, so it renders as
 * literal text too (F-17). `atLineStart` says whether offset 0 of `text` is a
 * real line start of the prose — it is not right after an inline code span.
 */
function escapeLinkDefinitions(text: string, atLineStart: boolean): string {
  return text.replace(LINK_DEFINITION, (def: string, indent: string, offset: number) =>
    offset === 0 && !atLineStart ? def : `${indent}\\${def.slice(indent.length)}`,
  );
}

/** Text outside code: links first (kept only when relative and known), then URLs and paths. */
function scrubText(raw: string, known: ReadonlySet<string>, atLineStart: boolean): string {
  const text = escapeLinkDefinitions(raw, atLineStart);
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
    const url = urls[i];
    if (!url) return;
    if (ANGLE_AUTOLINK.test(url)) {
      // `<scheme:…>` — both brackets were matched together, so both go (F-31)
      out += `\`${url.slice(1, -1)}\``;
    } else {
      const core = url.replace(URL_TRAILING_PUNCTUATION, '');
      out += core ? `\`${core}\`${url.slice(core.length)}` : url;
    }
  });
  return out;
}

/**
 * Scrub model prose (D-26): a path-like code span not in K is removed, and
 * so is a "()" it leaves empty (F-43); a link
 * whose href is external or unknown becomes its text; a link reference
 * definition is escaped (`\[`, insertion only); a bare URL, `www.`, email or
 * `<scheme:…>` autolink becomes code;
 * a known path outside code is wrapped in backticks. It never strips `_` and
 * never parses or emits HTML. Best effort: the client is what guarantees no
 * tour href is clickable (F-29).
 */
export function scrubProse(prose: string, known: ReadonlySet<string>): string {
  let out = '';
  let at = 0;
  for (const m of prose.matchAll(CODE)) {
    const start = m.index ?? 0;
    out += scrubText(prose.slice(at, start), known, isLineStart(prose, at));
    const span = m[0];
    if (span.startsWith('```')) {
      out += span;
    } else {
      const inner = span.slice(1, -1).trim();
      if (!(looksLikePath(inner) && !known.has(inner) && !known.has(inner.replace(/^\.\//, '')))) {
        out += span;
      } else {
        // An unknown path is removed (AC-61), with no double space where it
        // was. When it was the only thing inside parentheses, the emptied
        // "()" goes too — the prose read "server () providing" (F-43).
        out = out.replace(/[ \t]+$/, '');
        const closing = /^[ \t]*\)/.exec(prose.slice(start + span.length));
        if (out.endsWith('(') && closing) {
          out = out.slice(0, -1).replace(/[ \t]+$/, '');
          at = start + span.length + closing[0].length;
          continue;
        }
      }
    }
    at = start + span.length;
  }
  out += scrubText(prose.slice(at), known, isLineStart(prose, at));
  return out.trim();
}

// ---------------------------------------------------------------------------
// Failure classification (AC-72, D-20)
// ---------------------------------------------------------------------------

const SOURCE_UNREADABLE = 'source_unreadable';

/**
 * Thrown before the model call when git could not read the revision the facts
 * describe (F-52): a tour built from them would silently lose its README, its
 * commands and its tasks. No model call is made and nothing is stored.
 */
export class SourceUnreadableError extends Error {
  readonly code = SOURCE_UNREADABLE;
  constructor(message: string) {
    super(message);
    this.name = 'SourceUnreadableError';
  }
}

/**
 * `ConfigError` → `no_api_key`; `SourceUnreadableError` → `source_unreadable`; `TimeoutError` → `timeout`; a schema
 * validation failure → `invalid_output` with the fixed message; anything else
 * → `provider_error` with the error message, ≤ 300 chars.
 */
export function classifyGenerationError(err: unknown): { code: TourFailureCode; message: string } {
  const e = err as { name?: unknown; code?: unknown; message?: unknown } | null;
  const message = typeof e?.message === 'string' ? e.message : String(err);
  if (e?.code === 'config_error') return { code: 'no_api_key', message: oneLine(message, FAILURE_MESSAGE_MAX) };
  if (e?.code === SOURCE_UNREADABLE) return { code: 'source_unreadable', message: oneLine(message, FAILURE_MESSAGE_MAX) };
  if (e?.name === 'TimeoutError') return { code: 'timeout', message: oneLine(message, FAILURE_MESSAGE_MAX) };
  if (/failed schema|schema validation/i.test(message)) {
    return { code: 'invalid_output', message: INVALID_OUTPUT_MESSAGE };
  }
  return { code: 'provider_error', message: oneLine(message, FAILURE_MESSAGE_MAX) || 'unknown error' };
}

/** What the server logs about a failed generation (F-37). Nothing of it is stored. */
export interface GenerationFailureLog {
  code: TourFailureCode;
  /** The error's own message, one line, ≤ 300 chars — not the fixed UI text. */
  error: string;
  errorName: string | null;
  /** The provider's `finish_reason` (`length` = the output cap cut the answer). */
  finishReason?: string;
  /** zod issue paths + messages, at most `ZOD_ISSUES_LOG_MAX`. */
  issues?: string[];
  /** The first `RAW_EXCERPT_LOG_MAX` chars of the raw model output. */
  rawExcerpt?: string;
}

/**
 * The log record of a failed generation. The adapters today throw a plain
 * `Error` with only a message; `finishReason`, `issues` (zod issues or a
 * string) and `raw` are duck-typed off the error so they are logged the moment
 * an adapter attaches them. A raw excerpt is model output, never a secret.
 */
export function generationFailureLog(err: unknown): GenerationFailureLog {
  const e = (err ?? {}) as {
    name?: unknown;
    message?: unknown;
    finishReason?: unknown;
    issues?: unknown;
    raw?: unknown;
  };
  const message = typeof e.message === 'string' ? e.message : String(err);
  const out: GenerationFailureLog = {
    code: classifyGenerationError(err).code,
    error: oneLine(message, FAILURE_MESSAGE_MAX),
    errorName: typeof e.name === 'string' ? e.name : null,
  };
  if (typeof e.finishReason === 'string') out.finishReason = e.finishReason;
  if (Array.isArray(e.issues)) {
    out.issues = e.issues.slice(0, ZOD_ISSUES_LOG_MAX).map((i) => {
      const issue = (i ?? {}) as { path?: unknown; message?: unknown };
      const path = Array.isArray(issue.path) ? issue.path.join('.') : '';
      return oneLine(`${path || '(root)'}: ${typeof issue.message === 'string' ? issue.message : String(i)}`, ONE_LINE_MAX);
    });
  } else if (typeof e.issues === 'string') {
    out.issues = e.issues.split(/\r?\n/).filter(Boolean).slice(0, ZOD_ISSUES_LOG_MAX).map((l) => oneLine(l, ONE_LINE_MAX));
  }
  if (typeof e.raw === 'string') out.rawExcerpt = oneLine(e.raw, RAW_EXCERPT_LOG_MAX);
  return out;
}
