import type { SkillType } from '@devdigest/shared';

/**
 * Caps and classification tables for the skill import pipeline
 * (specs/L02-skills-in-the-product.md §6.4 / §6.5).
 *
 * Every number here is a guard that runs BEFORE anything is decompressed, so
 * the values are chosen against the *declared* sizes in a zip's central
 * directory — never against what an inflate would actually produce.
 */

/**
 * 2 MiB total declared uncompressed bytes. A skill is prose: the reference
 * archive is ~4 KiB, so 2 MiB is ~500x headroom while still fitting inside the
 * 4 MiB per-route `bodyLimit` once base64 adds its +33%.
 */
export const MAX_ARCHIVE_BYTES = 2 * 1024 * 1024;

/**
 * 256 KiB for any single entry. The core markdown is the only entry that is
 * ever inflated, and 256 KiB of markdown is far past what a human writes or a
 * model prompt can hold — anything bigger is a zip bomb, not a skill.
 */
export const MAX_ENTRY_BYTES = 256 * 1024;

/**
 * 256 entries. The preview renders every entry as a table row the user must
 * actually read before confirming; past a couple of hundred rows the listing
 * stops being reviewable, which is the whole point of showing it.
 */
export const MAX_ENTRIES = 256;

/**
 * Extensions that make an entry `executable` — listed in the preview, never
 * handed to `inflateRawSync`. The list is deliberately broad (scripts AND
 * native objects) because the cost of over-classifying is one extra warning
 * line, while the cost of under-classifying is the product claim "executable
 * parts are not processed" becoming false.
 */
export const EXECUTABLE_EXTENSIONS: readonly string[] = [
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
  '.bat',
  '.cmd',
  '.py',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.rb',
  '.pl',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
];

/**
 * Any entry inside a `bin/` directory is executable whatever its extension —
 * `bin/setup` with no extension at all is the common shape, and the directory
 * is the author's own statement of intent.
 */
export const EXECUTABLE_DIR = 'bin';

/**
 * The unix permission bits (owner/group/other execute) carried in the high 16
 * bits of a central-directory `external attributes` field. A file the author
 * marked `+x` is executable regardless of its name.
 */
export const UNIX_EXEC_MODE_MASK = 0o111;

/**
 * Extensions classified as `doc`: companion prose that is listed but never
 * read. `.markdown` lives here and NOT in the core candidates on purpose —
 * §6.4 picks the core among `.md` files only, so the precedence rules stay
 * exactly as written.
 */
export const DOC_EXTENSIONS: readonly string[] = ['.md', '.markdown', '.txt', '.rst'];

/**
 * Extensionless filenames that are still prose. Matched case-insensitively on
 * the basename so `LICENSE`, `license` and `COPYING` all land in `doc` instead
 * of the meaningless `other` bucket.
 */
export const DOC_FILENAMES: readonly string[] = [
  'license',
  'licence',
  'notice',
  'copying',
  'authors',
  'changelog',
];

/**
 * Basenames that are prose whatever follows them — `README`, `README.md`,
 * `README.rst`. Matched as a case-insensitive prefix of the basename.
 */
export const DOC_FILENAME_PREFIXES: readonly string[] = ['readme'];

/** The one extension an entry must have to be considered for the skill core. */
export const MARKDOWN_EXTENSION = '.md';

/**
 * Core precedence, highest first: an exact root filename wins over every
 * heuristic. Case matters — `SKILL.md` is the convention the docs teach, and
 * `skill.md` is the forgiving second chance for a case-sensitive author.
 * Beyond this list §6.4 falls back to "the only `.md` anywhere", then to the
 * shallowest path with alphabetical tie-breaking.
 */
export const CORE_CANDIDATES: readonly string[] = ['SKILL.md', 'skill.md'];

/**
 * 280 chars. The description is the skill's *interface* — one directive line a
 * future router reads to decide whether to load the skill at all — so it is
 * capped at roughly a sentence rather than allowed to become a second body.
 */
export const MAX_DESCRIPTION_CHARS = 280;

/**
 * The type assigned when the front matter names none, or names one that is not
 * a `SkillType`. `custom` is the honest default: guessing `rubric` from prose
 * would put a wrong badge on the card and the user would never notice.
 */
export const DEFAULT_SKILL_TYPE: SkillType = 'custom';

/** Every import through this module is `imported_file` provenance (D6). */
export const IMPORT_SOURCE = 'imported_file' as const;
