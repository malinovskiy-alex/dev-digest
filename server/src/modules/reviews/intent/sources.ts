import { createHash } from 'node:crypto';
import type { IntentConfidence, IntentSource, PrIntentRecord } from '@devdigest/shared';
import { sectionMeta, wrapUntrusted, type PromptSectionMeta } from '@devdigest/reviewer-core';
import { hashKey } from '../../../platform/model-router.js';
import {
  INTENT_PROMPT_VERSION,
  MAX_COMMIT_CHARS,
  MAX_COMMITS,
  MAX_DESCRIPTION_CHARS,
  MAX_FILES,
  MAX_HUNK_HEADER_CHARS,
  MAX_HUNK_HEADERS,
  MAX_INTENT_CHARS,
  MAX_LIST_ITEM_CHARS,
  MAX_LIST_ITEMS,
  MAX_SPEC_DOCS,
  MAX_TICKET_CHARS,
  MEANINGFUL_DESCRIPTION_CHARS,
  NO_DESCRIPTION_MARKER,
  SPEC_EXTENSIONS,
} from './constants.js';
import type { IntentLLMOutput } from './schema.js';

/**
 * Intent sources — PURE. Parsing, normalization, confidence, the cache key and
 * the two renderings (classifier input, review-prompt text). Everything that
 * needs I/O (GitHub, git, DB, the model) lives in `service.ts`; everything here
 * is computable from its arguments, so it can be unit-tested without mocks.
 *
 * Nothing in this file ever puts description / ticket / spec CONTENT into a
 * `sources` entry: those carry refs and statuses only, because they are logged
 * and shown in the UI.
 */

// ---------------------------------------------------------------- description

/**
 * Strip what a PR template leaves behind: HTML comments and checklist lines.
 * The rest is kept as the author wrote it (then capped).
 */
export function normalizeDescription(body: string | null | undefined): string {
  if (!body) return '';
  const text = body
    .replace(/\r\n/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter((line) => !/^\s*[-*]\s*\[[ xX]\]/.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.slice(0, MAX_DESCRIPTION_CHARS);
}

/**
 * Whether a normalized description says anything. Heading-only lines
 * (`## Summary`) are template scaffolding and do not count toward the length.
 */
export function isMeaningfulDescription(normalized: string): boolean {
  const prose = normalized
    .split('\n')
    .filter((line) => !/^\s*#{1,6}\s/.test(line))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return prose.length >= MEANINGFUL_DESCRIPTION_CHARS;
}

// ------------------------------------------------------------------- tickets

/**
 * Same-repo GitHub issues the PR closes — ONLY with a closing keyword
 * (`closes #12`, `Fixes: #12`, `resolved #12`). A bare `#12` is a mention, not
 * a ticket; `resolveLinkedIssue` in the GitHub adapter matches bare numbers and
 * is deliberately not reused here (spec §12).
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

/**
 * Tickets in systems we have no integration with (Jira, Linear, Notion). They
 * are recorded as `unresolved` and never fetched — fetching an arbitrary
 * author-supplied URL would be an SSRF vector.
 */
/** Key-shaped names that are standards and encodings, never tickets. */
const NOT_TICKET_PREFIXES = new Set(['UTF', 'SHA', 'MD', 'ISO', 'RFC', 'AES', 'RSA', 'HTTP', 'TLS', 'SSL', 'UTC', 'GMT', 'X', 'ES', 'IEEE']);

export function parseExternalTickets(text: string): string[] {
  const out = new Set<string>();
  const urlRe =
    /https?:\/\/[^\s)>\]"']*(?:atlassian\.net\/browse\/|linear\.app\/|notion\.so\/|notion\.site\/)[^\s)>\]"']*/gi;
  for (const m of text.matchAll(urlRe)) out.add(m[0]);
  // A Jira-style key only after a ticket keyword: a bare `UTF-8` / `SHA-256`
  // has the same shape and is not a ticket. The keyword is case-insensitive
  // ("JIRA", "Ticket:"), and only a few linking words may sit between it and
  // the key ("Ticket: see JIRA DEV-4521") — not arbitrary prose, or "Fixes
  // crash in SHA-256" would become a ticket. The key must be upper-case and
  // must not be a well-known standard or encoding name.
  const keyRe =
    /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|ticket|jira|refs?)\b[\s:]+(?:(?:see|in|the|issue|ticket|jira)\s+){0,2}([a-z][a-z0-9]{1,9}-\d{1,7})\b/gi;
  for (const m of text.matchAll(keyRe)) {
    const key = m[1];
    if (key && /^[A-Z][A-Z0-9]{1,9}-\d{1,7}$/.test(key) && !NOT_TICKET_PREFIXES.has(key.split('-')[0]!)) out.add(key);
  }
  return [...out];
}

// --------------------------------------------------------------------- specs

export type SpecLinkFailure = 'outside_repo' | 'external' | 'limit_exceeded';

/** A plan/spec reference found in the description or the ticket. */
export interface SpecLink {
  /** As written (for the UI and the log). */
  ref: string;
  /** Normalized repo-relative path to read, or null when it must not be read. */
  path: string | null;
  /** Why `path` is null. */
  reason?: SpecLinkFailure;
}

function hasSpecExtension(path: string): boolean {
  const lower = path.toLowerCase();
  return SPEC_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Normalize a repo-relative path, or return null when it points outside the
 * repository: absolute paths, drive letters, backslashes, `..` segments, a
 * leading `-` (would read as a git option) or a `:` (would read as a git
 * revision separator).
 */
export function normalizeRepoPath(raw: string): string | null {
  let p = raw.trim();
  try {
    p = decodeURIComponent(p);
  } catch {
    return null;
  }
  p = p.replace(/[?#].*$/, '');
  while (p.startsWith('./')) p = p.slice(2);
  if (p.length === 0) return null;
  if (p.startsWith('/') || p.startsWith('-') || /^[a-zA-Z]:/.test(p)) return null;
  if (p.includes('\\') || p.includes(':') || p.includes('\0')) return null;
  const segs = p.split('/');
  if (segs.some((s) => s === '..' || s === '.' || s === '')) return null;
  return p;
}

/**
 * Find every plan/spec reference in `text`:
 *   - relative `.md`/`.mdx`/`.txt` paths, bare or as a markdown link target;
 *   - `github.com/<owner>/<repo>/blob/<ref>/<path>` URLs of THIS repo.
 * Other URLs to a document are `external` (not fetched). Nothing found is ever
 * silently dropped: past MAX_SPEC_DOCS a link is kept as `limit_exceeded`.
 */
export function parseSpecLinks(text: string, repo: { owner: string; name: string }): SpecLink[] {
  const found: SpecLink[] = [];
  const seen = new Set<string>();
  const push = (link: SpecLink) => {
    const key = link.path ?? link.ref;
    if (seen.has(key)) return;
    seen.add(key);
    found.push(link);
  };

  const urlRe = /https?:\/\/[^\s)>\]"'`]+/gi;
  for (const m of text.matchAll(urlRe)) {
    const url = m[0].replace(/[.,;]+$/, '');
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    const host = parsed.hostname.toLowerCase();
    if (host === 'github.com' || host === 'www.github.com') {
      const parts = parsed.pathname.split('/').filter(Boolean);
      // owner / repo / blob / ref / ...path
      if (parts.length >= 5 && parts[2] === 'blob') {
        const filePath = parts.slice(4).join('/');
        if (!hasSpecExtension(filePath)) continue;
        const sameRepo =
          parts[0]!.toLowerCase() === repo.owner.toLowerCase() &&
          parts[1]!.toLowerCase() === repo.name.toLowerCase();
        if (!sameRepo) {
          push({ ref: url, path: null, reason: 'external' });
          continue;
        }
        const normalized = normalizeRepoPath(filePath);
        push(
          normalized
            ? { ref: normalized, path: normalized }
            : { ref: url, path: null, reason: 'outside_repo' },
        );
      }
      continue;
    }
    if (hasSpecExtension(parsed.pathname)) push({ ref: url, path: null, reason: 'external' });
  }

  // Relative paths — scanned with URLs blanked out so a URL's path is not
  // picked up a second time as a "relative" one.
  const withoutUrls = text.replace(urlRe, ' ');
  const pathRe = /(?:^|[\s(\[`'"<])((?:\.{1,2}\/|\/)?[\w.\-/%]+\.(?:mdx|md|txt))(?=$|[\s)\]`'">,;:!?#])/gim;
  for (const m of withoutUrls.matchAll(pathRe)) {
    const raw = m[1]!;
    const normalized = normalizeRepoPath(raw);
    push(
      normalized
        ? { ref: normalized, path: normalized }
        : { ref: raw, path: null, reason: 'outside_repo' },
    );
  }

  let readable = 0;
  return found.map((link) => {
    if (!link.path) return link;
    readable += 1;
    return readable <= MAX_SPEC_DOCS ? link : { ref: link.ref, path: null, reason: 'limit_exceeded' };
  });
}

// ----------------------------------------------------------------- confidence

/**
 * Confidence from WHICH sources really existed (spec §3), never from the
 * model's own opinion:
 *   high   — meaningful description AND a resolved ticket or spec
 *   medium — a meaningful description alone, or no description but a resolved
 *            ticket/spec
 *   low    — neither: inferred from title, branch, commits and files
 * An unresolved spec/ticket link caps the level at medium, and the model's
 * `ambiguous` flag lowers it one step. Nothing raises it.
 */
export function computeConfidence(input: {
  meaningfulDescription: boolean;
  resolvedTicketOrSpec: boolean;
  unresolvedLink: boolean;
  ambiguous: boolean;
}): IntentConfidence {
  let level: IntentConfidence;
  if (input.meaningfulDescription && input.resolvedTicketOrSpec) level = 'high';
  else if (input.meaningfulDescription || input.resolvedTicketOrSpec) level = 'medium';
  else level = 'low';
  if (input.unresolvedLink && level === 'high') level = 'medium';
  if (input.ambiguous) level = lowerConfidence(level);
  return level;
}

export function lowerConfidence(level: IntentConfidence): IntentConfidence {
  return level === 'high' ? 'medium' : 'low';
}

// ------------------------------------------------------------ gathered inputs

export interface IntentTicket {
  number: number;
  title: string;
  body: string;
}

export interface IntentSpec {
  path: string;
  content: string;
  /** True when the file was longer than MAX_SPEC_CHARS and only its start is here. */
  truncated?: boolean;
}

/** A ticket or spec the author referenced that could not be read. */
export interface UnavailableRef {
  type: 'ticket' | 'spec';
  ref: string;
  reason: string;
}

/** Everything the classifier sees, already fetched and capped. */
export interface IntentInputs {
  title: string;
  /** Normalized + capped. Empty when the PR has no body. */
  description: string;
  meaningfulDescription: boolean;
  branch: string;
  commits: string[];
  files: { path: string; additions: number; deletions: number }[];
  /** `@@ … @@` headers per file — only filled when there is no usable description. */
  hunks: { path: string; headers: string[] }[];
  ticket: IntentTicket | null;
  specs: IntentSpec[];
  /** Referenced but unreadable: shown to the classifier so it does not invent their content. */
  unavailable: UnavailableRef[];
}

/**
 * The hunk headers of a unified-diff patch: `@@ -a,b +c,d @@ <enclosing context>`.
 * Only these lines — never an added, removed or context line of the change.
 */
export function extractHunkHeaders(patch: string | null | undefined): string[] {
  if (!patch) return [];
  const out: string[] = [];
  for (const line of patch.split('\n')) {
    if (line.startsWith('@@')) out.push(line.trimEnd().slice(0, MAX_HUNK_HEADER_CHARS));
  }
  return out;
}

/** Headers for every file, capped in total so one huge PR cannot flood the classifier. */
export function capHunks(files: { path: string; patch: string | null }[]): { path: string; headers: string[] }[] {
  const out: { path: string; headers: string[] }[] = [];
  let left = MAX_HUNK_HEADERS;
  for (const f of files) {
    if (left <= 0) break;
    const headers = extractHunkHeaders(f.patch).slice(0, left);
    if (headers.length === 0) continue;
    out.push({ path: f.path, headers });
    left -= headers.length;
  }
  return out;
}

/**
 * Tickets and specs the author referenced that the intent could NOT fully use:
 * failed, deliberately not fetched, or truncated. The single source for the
 * classifier's "referenced but unavailable" section, the review prompt's
 * "Missing context" line and the UI block, so all three always agree.
 */
export function missingContext(sources: IntentSource[]): { type: string; ref: string; reason: string }[] {
  return sources
    .filter((s) => (s.type === 'ticket' || s.type === 'spec') && (s.status !== 'used' || s.reason === 'truncated'))
    .map((s) => ({ type: s.type, ref: s.ref, reason: s.reason ?? s.status }));
}

export function capCommits(messages: string[]): string[] {
  return messages.slice(0, MAX_COMMITS).map((m) => m.trim().slice(0, MAX_COMMIT_CHARS));
}

export function capFiles<T>(files: T[]): T[] {
  return files.slice(0, MAX_FILES);
}

export function capTicket(ticket: IntentTicket): IntentTicket {
  return { ...ticket, body: ticket.body.slice(0, MAX_TICKET_CHARS) };
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * The cache key (spec §5): every input the classifier sees, plus the model and
 * the prompt version. Any change — an edited description, a new commit, an
 * edited spec, another model chosen in Settings — produces a new key.
 */
export function intentInputHash(
  inputs: IntentInputs,
  model: { provider: string; model: string },
): string {
  return hashKey(
    INTENT_PROMPT_VERSION,
    model.provider,
    model.model,
    inputs.title,
    inputs.description,
    inputs.ticket ? `#${inputs.ticket.number}\n${inputs.ticket.title}\n${inputs.ticket.body}` : '',
    ...inputs.specs.map((s) => `${s.path}:${s.truncated ? 'truncated:' : ''}${sha256(s.content)}`),
    inputs.branch,
    sha256(inputs.commits.join('\n')),
    sha256(inputs.files.map((f) => `${f.path}:+${f.additions}/-${f.deletions}`).join('\n')),
    sha256(inputs.hunks.map((h) => `${h.path}\n${h.headers.join('\n')}`).join('\n')),
    inputs.unavailable.map((u) => `${u.type}:${u.ref}:${u.reason}`).join('\n'),
  );
}

// ------------------------------------------------------------ classifier input

/**
 * The classifier's user message: each source in its own untrusted block, so
 * an author's "ignore the auth change" is data and never an instruction.
 * Returns the text AND one PromptSectionMeta per block, built together so the
 * logged section sizes are exactly what the model receives.
 */
export function buildClassifierInput(inputs: IntentInputs): {
  text: string;
  sections: PromptSectionMeta[];
} {
  let text = '';
  const sections: PromptSectionMeta[] = [];
  // `sep` is what joins this block to the previous one: a blank line between
  // top-level sections, a single newline inside "Supporting signals".
  const add = (
    sep: string,
    block: string,
    name: string,
    source: string,
    trust: PromptSectionMeta['trust'],
    items?: string[],
  ) => {
    text += (text ? sep : '') + block;
    sections.push(sectionMeta(name, source, trust, block, items));
  };

  add('', 'Derive the intent of this pull request from the sources below.', 'task', 'server', 'trusted');
  add('\n\n', `## PR title\n${wrapUntrusted('pr-title', inputs.title)}`, 'pr_title', 'pr-author', 'untrusted');
  add(
    '\n\n',
    '## PR description\n' +
      (inputs.meaningfulDescription
        ? wrapUntrusted('pr-description', inputs.description)
        : `${NO_DESCRIPTION_MARKER}.` +
          (inputs.description ? `\n${wrapUntrusted('pr-description', inputs.description)}` : '')),
    'pr_description',
    'pr-author',
    'untrusted',
  );
  if (inputs.ticket) {
    add(
      '\n\n',
      `## Linked ticket #${inputs.ticket.number}\n` +
        wrapUntrusted('ticket', `${inputs.ticket.title}\n\n${inputs.ticket.body}`),
      'ticket',
      'github-issue',
      'untrusted',
    );
  }
  inputs.specs.forEach((spec, i) => {
    add(
      '\n\n',
      `## Linked spec: ${spec.path} (documented intent — it wins over the description)` +
        (spec.truncated ? ` — TRUNCATED: only the first ${spec.content.length} characters are shown` : '') +
        `\n${wrapUntrusted(`spec-${i}`, spec.content)}`,
      `spec-${i}`,
      'repo-spec',
      'untrusted',
    );
  });
  add(
    '\n\n',
    `## Supporting signals (indirect)\n### Branch\n${wrapUntrusted('branch', inputs.branch)}`,
    'branch',
    'pr-metadata',
    'untrusted',
  );
  if (inputs.commits.length > 0) {
    add(
      '\n',
      `### Commit messages\n${wrapUntrusted('commits', inputs.commits.map((c) => `- ${c}`).join('\n'))}`,
      'commits',
      'pr-commits',
      'untrusted',
      inputs.commits,
    );
  }
  if (inputs.files.length > 0) {
    const lines = inputs.files.map((f) => `${f.path} (+${f.additions}/-${f.deletions})`);
    add('\n', `### Changed files\n${wrapUntrusted('files', lines.join('\n'))}`, 'files', 'pr-files', 'untrusted', lines);
  }
  if (inputs.hunks.length > 0) {
    // Headers only (`@@ … @@ <enclosing function>`) — never the changed lines.
    const lines = inputs.hunks.flatMap((h) => [h.path, ...h.headers.map((x) => `  ${x}`)]);
    add(
      '\n',
      `### Hunk headers (where in each file the change lands)\n${wrapUntrusted('hunks', lines.join('\n'))}`,
      'hunks',
      'pr-hunk-headers',
      'untrusted',
      inputs.hunks.flatMap((h) => h.headers),
    );
  }
  if (inputs.unavailable.length > 0) {
    const lines = inputs.unavailable.map((u) => `- ${u.type} ${u.ref} — ${u.reason}`);
    add(
      '\n\n',
      '## Referenced but unavailable\n' +
        'The author referenced these, but their content could NOT be read. Do not guess what they say. ' +
        'Treat the scope they would define as unknown, and set `ambiguous` when they look central to the change.\n' +
        wrapUntrusted('unavailable', lines.join('\n')),
      'unavailable',
      'server',
      'untrusted',
      lines,
    );
  }
  return { text, sections };
}

export function renderClassifierInput(inputs: IntentInputs): string {
  return buildClassifierInput(inputs).text;
}

// --------------------------------------------------------------- output clamp

function clampList(items: string[]): string[] {
  return items
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, MAX_LIST_ITEMS)
    .map((s) => s.slice(0, MAX_LIST_ITEM_CHARS));
}

/** Enforce the output limits the schema only describes. */
export function clampOutput(out: IntentLLMOutput): IntentLLMOutput {
  return {
    ...out,
    intent: out.intent.trim().slice(0, MAX_INTENT_CHARS),
    in_scope: clampList(out.in_scope),
    out_of_scope: clampList(out.out_of_scope),
    risk_areas: clampList(out.risk_areas),
    conflicts: clampList(out.conflicts),
  };
}

// ------------------------------------------------------------- review prompt

const STATUS_MARK: Record<IntentSource['status'], string> = {
  used: '✓',
  failed: '✗',
  unresolved: '?',
};

/** One-line source summary for the Live Log and the review prompt. */
export function describeSources(sources: IntentSource[]): string {
  if (sources.length === 0) return 'none';
  return sources
    .map((s) => `${s.type} ${s.ref} ${STATUS_MARK[s.status]}${s.reason ? ` (${s.reason})` : ''}`)
    .join(', ');
}

/** Whether the description source was actually used (vs empty / template only). */
export function hasUsableDescription(sources: IntentSource[]): boolean {
  return sources.some((s) => s.type === 'description' && s.status === 'used');
}

/**
 * The text the review prompt receives (reviewer-core wraps it as untrusted and
 * puts the scope rule above it). Empty intent → empty string, so the section
 * is omitted and the prompt stays byte-identical to the pre-intent build.
 */
export function formatIntentForPrompt(record: PrIntentRecord): string {
  if (record.intent.trim().length === 0) return '';
  const lines: string[] = [];
  lines.push(`Intent: ${record.intent}`);
  if (record.kind) lines.push(`Kind: ${record.kind}`);
  lines.push(`Confidence: ${record.confidence}`);
  if (record.confidence === 'low') {
    lines.push(
      hasUsableDescription(record.sources)
        ? 'Note: the sources are thin or contradict each other — this intent is a GUESS, not a firm statement by the author.'
        : 'Note: the PR has no usable description — this intent is a GUESS inferred from the title, branch, commits, files and hunk headers, not a statement by the author.',
    );
  }
  const missing = missingContext(record.sources);
  if (missing.length > 0) {
    lines.push(
      `Missing context — referenced by the author but NOT available to this intent; do not assume what they say: ${missing
        .map((m) => `${m.type} ${m.ref} (${m.reason})`)
        .join(', ')}`,
    );
  }
  const bullets = (label: string, items: string[]) => {
    if (items.length === 0) return;
    lines.push(`${label}:`);
    for (const item of items) lines.push(`- ${item}`);
  };
  bullets('In scope', record.in_scope);
  bullets('Out of scope', record.out_of_scope);
  bullets('Risk areas', record.risk_areas);
  bullets('Spec ↔ description conflicts (the spec wins)', record.conflicts);
  lines.push(`Sources: ${describeSources(record.sources)}`);
  return lines.join('\n');
}
