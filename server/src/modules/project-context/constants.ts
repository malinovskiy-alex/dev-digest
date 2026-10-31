/** A document longer than this is cut before it goes into a prompt (R-52). */
export const MAX_CONTEXT_DOC_CHARS = 32_000;

/**
 * Budget for the whole `## Project context` section of one run, counted on the
 * already-cut document texts (R-73, decision F-15). Documents are added in
 * R-46 order while they fit; the first one that does not fit, and every one
 * after it, is skipped with the reason `budget`.
 */
export const MAX_CONTEXT_TOTAL_CHARS = 128_000;

/** The listing shows at most this many documents, first by path (D-REC5). */
export const MAX_LISTED_DOCS = 1_000;

/** Parallel `git show` reads while resolving one agent's prompt documents. */
export const PROMPT_READ_CONCURRENCY = 8;

/** Listings memoised per (repo, sha). A sha is immutable, so an entry never goes stale. */
export const LIST_CACHE_ENTRIES = 20;

/**
 * Prompt-ready document texts memoised per (repo, sha, path), so several agents
 * of one run read each blob once. An entry is at most ~32 kB, so this caps the
 * cache at a few MB.
 */
export const CONTENT_CACHE_ENTRIES = 200;

/** The viewer refuses a blob larger than this (bytes, from `ls-tree -l`) before reading it. */
export const MAX_CONTEXT_DOC_VIEW_BYTES = 1_048_576;

/** Error code of a document path that is not in the tree at HEAD (R-14). */
export const CONTEXT_DOC_NOT_FOUND = 'context_doc_not_found';

/** Error code of a document too large for the viewer. */
export const CONTEXT_DOC_TOO_LARGE = 'context_doc_too_large';

/** Error code of a content read on a repo that has no local clone (R-12). */
export const CONTEXT_NOT_CLONED = 'context_not_cloned';
