import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

import type {
  SkillImportEntry,
  SkillImportEntryKind,
  SkillImportPreview,
  SkillType,
} from '@devdigest/shared';
import { SkillType as SkillTypeSchema } from '@devdigest/shared';

import { AppError } from '../../platform/errors.js';
import {
  CORE_CANDIDATES,
  DEFAULT_SKILL_TYPE,
  DOC_EXTENSIONS,
  DOC_FILENAMES,
  DOC_FILENAME_PREFIXES,
  EXECUTABLE_DIR,
  EXECUTABLE_EXTENSIONS,
  IMPORT_SOURCE,
  MARKDOWN_EXTENSION,
  MAX_ARCHIVE_BYTES,
  MAX_DESCRIPTION_CHARS,
  MAX_ENTRIES,
  MAX_ENTRY_BYTES,
  UNIX_EXEC_MODE_MASK,
} from './constants.js';
import { ZipFormatError, inflateEntry, readCentralDirectory, type ZipEntry } from './zip.js';

/**
 * PURE upload parsing: bytes in, `SkillImportPreview` out. No db, no fs, no
 * network — this file is the part of the import flow that is worth unit
 * testing, and it runs in the fast suite with no Postgres.
 *
 * The ordering rule from spec §6.4 is the whole design: EVERY guard runs
 * before any inflate, and then exactly ONE entry — the chosen core — is
 * decompressed. `inflateEntry` is called from a single call site in this file
 * (`parseArchive`, step 6) and from nowhere else in the module.
 */

export type ImportUpload =
  | { kind: 'markdown'; filename: string; text: string }
  | { kind: 'archive'; filename: string; base64: string };

/** 422 — the archive holds no markdown to use as the skill body. */
const noSkillCore = (message: string) => new AppError('no_skill_core', message, 422);
/** 422 — not a ZIP at all, or a ZIP we cannot read. */
const unsupportedArchive = (message: string) => new AppError('unsupported_archive', message, 422);
/** 422 — an entry name escapes the archive root. */
const unsafeEntryPath = (message: string) => new AppError('unsafe_entry_path', message, 422);
/** 413 — a declared size busts a cap. Thrown before anything is decompressed. */
const archiveTooLarge = (message: string) => new AppError('archive_too_large', message, 413);

/**
 * Parse an upload into the preview the user confirms. Writes nothing.
 * Throws `AppError` (`no_skill_core`, `unsupported_archive`,
 * `unsafe_entry_path`, `archive_too_large`).
 */
export function parseUpload(upload: ImportUpload): SkillImportPreview {
  return upload.kind === 'markdown' ? parseMarkdown(upload) : parseArchive(upload);
}

// ---------------------------------------------------------------------------
// Markdown upload — no archive, so none of §6.4 applies.
// ---------------------------------------------------------------------------

function parseMarkdown(upload: { filename: string; text: string }): SkillImportPreview {
  // The same ceiling the archive path enforces per entry. Without it, a body a
  // .zip rejects at 256 KiB sails through as a ~4 MiB skill (the route's
  // bodyLimit) and then goes into an agent's prompt on every review — which
  // would also make the stated reasoning behind MAX_ENTRY_BYTES untrue.
  const size = Buffer.byteLength(upload.text, 'utf8');
  if (size > MAX_ENTRY_BYTES) {
    throw archiveTooLarge(
      `"${upload.filename}" is ${size} bytes; the limit for one file is ${MAX_ENTRY_BYTES}.`,
    );
  }

  const fields = extractFields(upload.text, upload.filename);
  return {
    ...fields,
    token: hashBody(fields.body),
    source: IMPORT_SOURCE,
    entries: [
      {
        path: upload.filename,
        bytes: Buffer.byteLength(upload.text, 'utf8'),
        kind: 'core',
        ignored: false,
      },
    ],
    // Nothing was ignored, so there is nothing to warn about.
    warnings: [],
  };
}

// ---------------------------------------------------------------------------
// Archive upload — the guarded pipeline of §6.4, in order.
// ---------------------------------------------------------------------------

function parseArchive(upload: { filename: string; base64: string }): SkillImportPreview {
  const buf = Buffer.from(upload.base64, 'base64');

  // ── 1. EOCD found? ───────────────────────────────────────────────────────
  let listing: ZipEntry[];
  try {
    // Normalise separators ONCE, here, so every guard and classifier below
    // works on a single form. The zip spec says forward slashes, but archives
    // written on Windows carry backslashes — and a `bin\install` entry that
    // the classifier reads as `other` loses its "executable — listed only,
    // never read or run" warning on the very screen D6's vetting depends on.
    listing = readCentralDirectory(buf).map((entry) => ({
      ...entry,
      path: entry.path.replaceAll('\\', '/'),
    }));
  } catch (err) {
    if (err instanceof ZipFormatError) throw unsupportedArchive(err.message);
    throw err;
  }

  // ── 2. Entry count ───────────────────────────────────────────────────────
  if (listing.length > MAX_ENTRIES) {
    throw archiveTooLarge(
      `Archive holds ${listing.length} entries; the limit is ${MAX_ENTRIES}.`,
    );
  }

  // ── 3. Path safety ───────────────────────────────────────────────────────
  // We never write to disk, but a traversal name must not reach the UI looking
  // like a real path. Checked for directory records too — they are names the
  // preview would otherwise echo.
  for (const entry of listing) {
    if (isUnsafePath(entry.path)) {
      throw unsafeEntryPath(`Archive entry "${entry.path}" escapes the archive root.`);
    }
  }

  // Directory records carry no content; drop them from everything below.
  const files = listing.filter((entry) => !entry.path.endsWith('/'));

  // ── 4. Declared sizes — the zip-bomb guard ───────────────────────────────
  // Read from the central directory, BEFORE a single byte is decompressed, so
  // a 10 KB archive that claims to expand to 4 GB is refused rather than
  // inflated and measured.
  if (buf.length > MAX_ARCHIVE_BYTES) {
    throw archiveTooLarge(
      `Archive is ${buf.length} bytes; the limit is ${MAX_ARCHIVE_BYTES}.`,
    );
  }
  let declaredTotal = 0;
  for (const entry of files) {
    if (entry.bytes > MAX_ENTRY_BYTES) {
      throw archiveTooLarge(
        `Archive entry "${entry.path}" declares ${entry.bytes} bytes; the per-entry limit is ${MAX_ENTRY_BYTES}.`,
      );
    }
    declaredTotal += entry.bytes;
    if (declaredTotal > MAX_ARCHIVE_BYTES) {
      throw archiveTooLarge(
        `Archive declares more than ${MAX_ARCHIVE_BYTES} uncompressed bytes.`,
      );
    }
  }

  // ── 5. Classify every entry (§6.5) ───────────────────────────────────────
  const core = pickCore(files);
  if (!core) {
    throw noSkillCore('Archive contains no markdown file to use as the skill body.');
  }

  const entries: SkillImportEntry[] = files.map((entry) => {
    const kind: SkillImportEntryKind = entry === core ? 'core' : classify(entry);
    return { path: entry.path, bytes: entry.bytes, kind, ignored: kind !== 'core' };
  });

  // ── 6. Inflate the core entry and NOTHING else ───────────────────────────
  // The single `inflateEntry` call site in the module. Everything above ran on
  // central-directory metadata alone.
  let text: string;
  try {
    text = inflateEntry(buf, core);
  } catch (err) {
    if (err instanceof ZipFormatError) throw unsupportedArchive(err.message);
    throw err;
  }

  const fields = extractFields(text, core.path);
  return {
    ...fields,
    token: hashBody(fields.body),
    source: IMPORT_SOURCE,
    entries,
    warnings: buildWarnings(entries),
  };
}

/** `..` anywhere in the path, an absolute path, or a Windows drive letter. */
function isUnsafePath(path: string): boolean {
  if (path.length === 0) return true;
  if (path.startsWith('/') || path.startsWith('\\')) return true;
  if (/^[A-Za-z]:/.test(path)) return true;
  return path.split(/[/\\]/).includes('..');
}

// ---------------------------------------------------------------------------
// Classification (§6.5)
// ---------------------------------------------------------------------------

function basename(path: string): string {
  const cut = path.lastIndexOf('/');
  return cut < 0 ? path : path.slice(cut + 1);
}

function extension(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot).toLowerCase();
}

function isExecutable(entry: ZipEntry): boolean {
  if (EXECUTABLE_EXTENSIONS.includes(extension(entry.path))) return true;
  if (entry.path.split('/').slice(0, -1).includes(EXECUTABLE_DIR)) return true;
  return (entry.unixMode & UNIX_EXEC_MODE_MASK) !== 0;
}

function isDoc(path: string): boolean {
  if (DOC_EXTENSIONS.includes(extension(path))) return true;
  const name = basename(path).toLowerCase();
  if (DOC_FILENAMES.includes(name)) return true;
  return DOC_FILENAME_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/** Classify a non-core entry. `executable` wins: it is the claim we must not get wrong. */
function classify(entry: ZipEntry): SkillImportEntryKind {
  if (isExecutable(entry)) return 'executable';
  if (isDoc(entry.path)) return 'doc';
  return 'other';
}

// ---------------------------------------------------------------------------
// Core selection (§6.4)
// ---------------------------------------------------------------------------

/**
 * Precedence: root `SKILL.md` → root `skill.md` → the only `.md` anywhere →
 * shallowest path, ties broken alphabetically. An entry classified
 * `executable` is never a candidate — a `.md` carrying an exec bit is one the
 * author marked as a program, and we do not decompress those.
 */
function pickCore(files: ZipEntry[]): ZipEntry | undefined {
  const candidates = files.filter(
    (entry) => extension(entry.path) === MARKDOWN_EXTENSION && !isExecutable(entry),
  );
  if (candidates.length === 0) return undefined;

  for (const name of CORE_CANDIDATES) {
    const root = candidates.find((entry) => entry.path === name);
    if (root) return root;
  }
  if (candidates.length === 1) return candidates[0];

  return [...candidates].sort((a, b) => {
    const depth = a.path.split('/').length - b.path.split('/').length;
    if (depth !== 0) return depth;
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  })[0];
}

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

function buildWarnings(entries: SkillImportEntry[]): string[] {
  const warnings = entries
    .filter((entry) => entry.kind === 'executable')
    .map((entry) => `${entry.path} is executable — listed only, never read or run.`);

  const ignored = entries.filter((entry) => entry.ignored).length;
  if (ignored > 0) {
    warnings.push(`${ignored} of ${entries.length} entries were ignored.`);
  }
  return warnings;
}

// ---------------------------------------------------------------------------
// Field extraction (§6.4)
// ---------------------------------------------------------------------------

export interface ExtractedFields {
  name: string;
  description: string;
  type: SkillType;
  body: string;
}

/**
 * Deliberately minimal front matter: a leading `---` line, `key: value` pairs,
 * a closing `---`. No YAML dependency, and only `name`, `description` and
 * `type` are read — nothing in an uploaded file can set `enabled`, `source` or
 * `id`. It is a convenience, not a contract: every extracted field is editable
 * in the preview, so a misparse costs a keystroke.
 */
function splitFrontMatter(text: string): { data: Map<string, string>; body: string } {
  const data = new Map<string, string>();
  const lines = text.split('\n');
  if (lines[0]?.trimEnd() !== '---') return { data, body: text };

  let close = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i]?.trimEnd() === '---') {
      close = i;
      break;
    }
  }
  if (close < 0) return { data, body: text };

  for (let i = 1; i < close; i += 1) {
    const line = lines[i] ?? '';
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    if (key !== 'name' && key !== 'description' && key !== 'type') continue;
    data.set(key, unquote(line.slice(colon + 1).trim()));
  }

  return { data, body: stripLeadingBlankLines(lines.slice(close + 1).join('\n')) };
}

function unquote(value: string): string {
  const quoted = /^(['"])(.*)\1$/.exec(value);
  return (quoted?.[2] ?? value).trim();
}

function stripLeadingBlankLines(text: string): string {
  return text.replace(/^(?:[ \t]*\r?\n)+/, '');
}

function firstHeading(body: string): string | undefined {
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('#')) {
      const heading = line.replace(/^#+/, '').trim();
      if (heading) return heading;
    }
  }
  return undefined;
}

/** The first non-empty, non-heading paragraph — joined into one line and capped. */
function firstParagraph(body: string): string | undefined {
  const paragraph: string[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('#') || line === '---') {
      if (paragraph.length > 0) break;
      continue;
    }
    if (line === '') {
      if (paragraph.length > 0) break;
      continue;
    }
    paragraph.push(line);
  }
  return paragraph.length > 0 ? paragraph.join(' ') : undefined;
}

function clamp(value: string): string {
  return value.length > MAX_DESCRIPTION_CHARS
    ? value.slice(0, MAX_DESCRIPTION_CHARS).trimEnd()
    : value;
}

function nameFromFilename(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? name : name.slice(0, dot);
}

/**
 * name: front matter → first `#` heading → filename without extension.
 * description: front matter → first non-empty paragraph, capped at 280 chars.
 * type: front matter, only when it parses as a `SkillType` → `custom`.
 * body: the markdown with the front matter stripped.
 */
export function extractFields(text: string, path: string): ExtractedFields {
  const { data, body } = splitFrontMatter(text);

  const declaredType = data.get('type');
  const parsedType = declaredType ? SkillTypeSchema.safeParse(declaredType) : undefined;

  return {
    name: data.get('name') || firstHeading(body) || nameFromFilename(path),
    description: clamp(data.get('description') || firstParagraph(body) || ''),
    type: parsedType?.success ? parsedType.data : DEFAULT_SKILL_TYPE,
    body,
  };
}

/**
 * The preview `token`: sha256 of the extracted core body. `confirmImport`
 * re-parses the same upload and compares — a body that changed between preview
 * and confirm is a 409, never a silent swap.
 */
export function hashBody(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}
