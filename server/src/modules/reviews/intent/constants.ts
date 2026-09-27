/**
 * L03 intent layer — literals and limits. See specs/L03-intent-layer.md.
 */

/** Classifier system prompt, under `server/src/prompts/` (loaded by `renderPrompt`). */
export const INTENT_PROMPT_FILE = 'intent-classifier.system.md';

/**
 * Bump whenever the classifier prompt, the output schema or the way inputs are
 * rendered changes: it is part of the cache key, so every cached intent is
 * re-derived on the next read.
 */
export const INTENT_PROMPT_VERSION = 'intent-v1';

export const INTENT_SCHEMA_NAME = 'PrIntent';
export const INTENT_TEMPERATURE = 0;
export const INTENT_MAX_TOKENS = 1_500;
/** A cheap model on a small input; if it takes longer than this, the review goes on without intent. */
export const INTENT_TIMEOUT_MS = 20_000;
export const INTENT_MAX_RETRIES = 1;

/** Same cap `reviewer-core` applies to the PR description in the review prompt. */
export const MAX_DESCRIPTION_CHARS = 4_000;
/** A description shorter than this (after the template is stripped) counts as "no description". */
export const MEANINGFUL_DESCRIPTION_CHARS = 80;
export const MAX_TICKET_CHARS = 4_000;

/** At most this many linked specs are read; every further link is recorded as failed, never dropped. */
export const MAX_SPEC_DOCS = 3;
/** A spec longer than this is not read (recorded as `too_large`). */
export const MAX_SPEC_CHARS = 8_000;
/** Only these are read as specs — never code, never config, never dotfiles. */
export const SPEC_EXTENSIONS = ['.md', '.mdx', '.txt'] as const;

/** Indirect sources, capped so a 400-commit PR cannot blow the classifier's budget. */
export const MAX_COMMITS = 40;
export const MAX_COMMIT_CHARS = 300;
export const MAX_FILES = 150;

/** Output limits the classifier is asked for — and clamped to after parsing. */
export const MAX_INTENT_CHARS = 300;
export const MAX_LIST_ITEMS = 6;
export const MAX_LIST_ITEM_CHARS = 160;

/** The marker the classifier sees when the author wrote no usable description (spec §3). */
export const NO_DESCRIPTION_MARKER =
  'NO AUTHOR DESCRIPTION — infer from indirect signals, be conservative';

