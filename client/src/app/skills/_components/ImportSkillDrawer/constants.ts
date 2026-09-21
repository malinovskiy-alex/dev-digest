/** Constants for the skill import flow. */

/** Drawer width — wide enough for the entry table plus the extracted body. */
export const DRAWER_WIDTH = 760;

/** What the picker accepts. The server reads markdown as text and a .zip as
    base64; nothing else is parseable. */
export const ACCEPTED_FILES = ".md,.markdown,.zip";

/**
 * 2 MB, enforced here as well as on the server. Catching it client-side turns a
 * slow upload that ends in a 413 into an instant, explainable refusal — and the
 * server's own cap (`archive_too_large`) still backs it up.
 */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** Rows for the two multi-line fields of the preview step. */
export const DESCRIPTION_ROWS = 3;
export const BODY_ROWS = 12;

/** `String.fromCharCode` is applied to slices this big when base64-ing an
    archive; the whole buffer at once blows the argument limit. */
export const BASE64_CHUNK = 0x8000;

/**
 * The API error codes this flow can produce. Each one has a matching
 * `skills.errors.<code>` string, so the code IS the message key — a new server
 * code shows up as a missing translation rather than a silent generic failure.
 */
export const IMPORT_ERROR_CODES = [
  "no_skill_core",
  "unsupported_archive",
  "unsafe_entry_path",
  "archive_too_large",
  "import_changed",
] as const;

export type ImportErrorCode = (typeof IMPORT_ERROR_CODES)[number];
