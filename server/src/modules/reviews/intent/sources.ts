import { createHash } from 'node:crypto';
import type { IntentConfidence, IntentSource, PrIntentRecord } from '@devdigest/shared';
import { wrapUntrusted } from '@devdigest/reviewer-core';
import { hashKey } from '../../../platform/model-router.js';
import {
  INTENT_PROMPT_VERSION,
  MAX_COMMIT_CHARS,
  MAX_COMMITS,
  MAX_DESCRIPTION_CHARS,
  MAX_FILES,
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
export function parseExternalTickets(text: string): string[] {
  const out = new Set<string>();
  const urlRe =
    /https?:\/\/[^\s)>\]"']*(?:atlassian\.net\/browse\/|linear\.app\/|notion\.so\/|notion\.site\/)[^\s)>\]"']*/gi;
  for (const m of text.matchAll(urlRe)) out.add(m[0]);
  // A Jira-style key only after a ticket keyword: a bare `UTF-8` / `SHA-256`
  // has the same shape and is not a ticket.
  const keyRe = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|ticket|jira|refs?)\b\s*:?\s+([A-Z][A-Z0-9]{1,9}-\d{1,7})\b/g;
  for (const m of text.matchAll(keyRe)) if (m[1]) out.add(m[1]);
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
  ticket: IntentTicket | null;
  specs: IntentSpec[];
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
    ...inputs.specs.map((s) => `${s.path}:${sha256(s.content)}`),
    inputs.branch,
    sha256(inputs.commits.join('\n')),
    sha256(inputs.files.map((f) => `${f.path}:+${f.additions}/-${f.deletions}`).join('\n')),
  );
}

// ------------------------------------------------------------ classifier input

/**
 * The classifier's user message: each source in its own untrusted block, so
 * an author's "ignore the auth change" is data and never an instruction.
 */
export function renderClassifierInput(inputs: IntentInputs): string {
  const parts: string[] = [
    'Derive the intent of this pull request from the sources below.',
    '',
    '## PR title',
    wrapUntrusted('pr-title', inputs.title),
    '',
    '## PR description',
    inputs.meaningfulDescription
      ? wrapUntrusted('pr-description', inputs.description)
      : `${NO_DESCRIPTION_MARKER}.` +
        (inputs.description ? `\n${wrapUntrusted('pr-description', inputs.description)}` : ''),
  ];
  if (inputs.ticket) {
    parts.push(
      '',
      `## Linked ticket #${inputs.ticket.number}`,
      wrapUntrusted('ticket', `${inputs.ticket.title}\n\n${inputs.ticket.body}`),
    );
  }
  inputs.specs.forEach((spec, i) => {
    parts.push(
      '',
      `## Linked spec: ${spec.path} (documented intent — it wins over the description)`,
      wrapUntrusted(`spec-${i}`, spec.content),
    );
  });
  parts.push('', '## Supporting signals (indirect)', '### Branch', wrapUntrusted('branch', inputs.branch));
  if (inputs.commits.length > 0) {
    parts.push('### Commit messages', wrapUntrusted('commits', inputs.commits.map((c) => `- ${c}`).join('\n')));
  }
  if (inputs.files.length > 0) {
    parts.push(
      '### Changed files',
      wrapUntrusted(
        'files',
        inputs.files.map((f) => `${f.path} (+${f.additions}/-${f.deletions})`).join('\n'),
      ),
    );
  }
  return parts.join('\n');
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
      'Note: the PR has no usable description — this intent is a GUESS inferred from the title, branch, commits and files, not a statement by the author.',
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
