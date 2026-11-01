/**
 * Onboarding Tour (L05) — literals, caps and lookup tables. Each one names the
 * AC or decision (`specs/L05-onboarding-generator.md`) it implements.
 */

// ---- Fact budget (AC-66, AC-68) ----
/** The rendered fact set the model sees is at most this many chars (AC-66). */
export const FACTS_MAX_CHARS = 40_000;
/** Every file excerpt (README, manifests, TODO scan) is cut to this (AC-68). */
export const EXCERPT_MAX_CHARS = 6_000;
/**
 * A blob larger than this (bytes, from `ls-tree -l`) is never read — not even
 * for an excerpt — so a huge README or manifest is not buffered whole (F-18).
 * The same cap as the project-context viewer's `MAX_CONTEXT_DOC_VIEW_BYTES`.
 */
export const READ_MAX_BYTES = 1_048_576;
/** At most this many route lines reach the prompt (AC-66). */
export const MAX_ROUTES = 60;
/** At most this many top-level folders are listed (D-6, AC-34). */
export const MAX_FOLDERS = 30;
/** At most this many first-level `<dir>/package.json` are read (D-6). */
export const MAX_SUB_MANIFESTS = 4;

// ---- Section sizes ----
/** Critical-path rows (AC-35). */
export const MAX_CRITICAL_ROWS = 6;
/** Reading-path rows (AC-48). */
export const READING_PATH_SIZE = 8;
/** Top-ranked files scanned for TODOs and missing tests (D-15, D-16). */
export const TODO_SCAN_FILES = 30;
/** Task candidates offered to the model (D-18, AC-53). */
export const MAX_CANDIDATES = 15;
/** Fewer surviving model tasks than this → fallback tasks (AC-56). */
export const MIN_MODEL_TASKS = 3;
/** At most this many tasks are shown (AC-54, D-19). */
export const MAX_TASKS = 5;

// ---- The one model call (AC-21, AC-71, AC-83) ----
/** Output token cap of the single call (AC-83). */
export const OUTPUT_MAX_TOKENS = 4_000;
/** Wall-clock cap around the call (AC-71, D-21). */
export const GENERATION_TIMEOUT_MS = 120_000;
/** Deterministic sampling. */
export const GENERATION_TEMPERATURE = 0;
/** No schema re-ask or repair: exactly one call (AC-21, D-40). */
export const GENERATION_MAX_RETRIES = 0;

export const TOUR_SCHEMA_NAME = 'OnboardingTour';
/** `JobRunner` kind of one tour generation (F-03). */
export const TOUR_JOB_KIND = 'onboarding-tour-generate';
export const TOUR_PROMPT_FILE = 'onboarding.system.md';
export const TOUR_LANGUAGE = 'English';

// ---- Text caps ----
/** TODO text kept per candidate (D-15). */
export const TODO_TEXT_MAX = 200;
/** A model reason / why, one line (D-13, AC-36). */
export const ONE_LINE_MAX = 200;
/** A command comment, one line (D-10). */
export const COMMENT_MAX = 160;
/** A diagram label, one line (D-11). */
export const LABEL_MAX = 40;
/** Diagram components kept after grounding (D-11). */
export const MAX_COMPONENTS = 12;
/** Diagram connections kept after grounding (D-11). */
export const MAX_CONNECTIONS = 24;
/** Env-example variable names kept (D-8, AC-64). */
export const MAX_ENV_NAMES = 50;
/** Open PRs read as candidates (D-17). */
export const OPEN_PR_LIMIT = 50;
/** Memoised fact sets, LRU (D-33). */
export const FACTS_CACHE_ENTRIES = 20;
/** A provider error message kept in a failure (D-20). */
export const FAILURE_MESSAGE_MAX = 300;
/** The stored envelope's version (D-4). */
export const STORED_TOUR_VERSION = 1;
/** The exact failure text for a schema-invalid answer (AC-72). */
export const INVALID_OUTPUT_MESSAGE = 'the model returned invalid output';

// ---- Run commands (AC-40, D-7, D-8, D-9, D-44) ----
/** Script names that become commands, in derivation order — exactly AC-40 (D-9). */
export const SCRIPT_ALLOW_LIST = [
  'dev',
  'start',
  'serve',
  'build',
  'test',
  'migrate',
  'db:migrate',
  'seed',
  'db:seed',
] as const;

/**
 * Lockfile name → package manager and install command, in precedence order
 * (D-7). No lockfile → no install command. Detected by name, never read.
 */
export const LOCKFILE_INSTALL: ReadonlyArray<{ file: string; pm: string; install: string }> = [
  { file: 'pnpm-lock.yaml', pm: 'pnpm', install: 'pnpm install' },
  { file: 'package-lock.json', pm: 'npm', install: 'npm ci' },
  { file: 'yarn.lock', pm: 'yarn', install: 'yarn install' },
  { file: 'bun.lock', pm: 'bun', install: 'bun install' },
  { file: 'bun.lockb', pm: 'bun', install: 'bun install' },
];

/** The package manager used for `<pm> run <script>` when a dir has no lockfile (D-9). */
export const DEFAULT_PM = 'npm';

/**
 * A directory segment that may appear in a command (D-44, INV-15). It may not
 * start with `-`, so `cd <dir>` can never read it as an option (`cd -P`, F-20).
 */
export const SAFE_DIR_SEGMENT = /^[A-Za-z0-9._][A-Za-z0-9._-]*$/;

/** Env-example file names, first existing wins per dir (D-8). */
export const ENV_EXAMPLE_NAMES = ['.env.example', '.env.sample', '.env.template', 'example.env'] as const;

/** Root compose file names, detected by name only and never read (D-8, D-12). */
export const COMPOSE_FILE_NAMES = [
  'docker-compose.yml',
  'docker-compose.yaml',
  'compose.yml',
  'compose.yaml',
] as const;

/** The compose command (AC-40). */
export const COMPOSE_COMMAND = 'docker compose up -d';

/** The README at the root (D-8). */
export const README_PATTERN = /^readme(\.md)?$/i;

/** Directories never picked as sub-manifest dirs (D-6) — the indexer's own excludes. */
export const EXCLUDED_DIRS = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  'out',
  'vendor',
  '.git',
] as const;

// ---- Stack detection (AC-20, AC-34) ----
/** Dependency name → framework label, in display order (step 3). */
export const FRAMEWORK_DEPENDENCIES: ReadonlyArray<{ dep: string; label: string }> = [
  { dep: 'next', label: 'Next.js' },
  { dep: 'react', label: 'React' },
  { dep: 'vue', label: 'Vue' },
  { dep: 'svelte', label: 'Svelte' },
  { dep: '@angular/core', label: 'Angular' },
  { dep: 'fastify', label: 'Fastify' },
  { dep: 'express', label: 'Express' },
  { dep: '@nestjs/core', label: 'NestJS' },
  { dep: 'koa', label: 'Koa' },
  { dep: 'hono', label: 'Hono' },
  { dep: 'drizzle-orm', label: 'Drizzle ORM' },
  { dep: 'prisma', label: 'Prisma' },
  { dep: '@prisma/client', label: 'Prisma' },
  { dep: 'typeorm', label: 'TypeORM' },
  { dep: 'mongoose', label: 'Mongoose' },
  { dep: 'vitest', label: 'Vitest' },
  { dep: 'jest', label: 'Jest' },
  { dep: '@playwright/test', label: 'Playwright' },
  { dep: 'tailwindcss', label: 'Tailwind CSS' },
  { dep: 'zod', label: 'Zod' },
  { dep: '@tanstack/react-query', label: 'TanStack Query' },
];

/** File extension → language, over indexed paths (AC-34). */
export const EXTENSION_LANGUAGE: Readonly<Record<string, string>> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
};

/** Test-file basename, for the missing-tests rule (D-16). */
export const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/;

/**
 * A TODO/FIXME/HACK marker inside a comment (D-15). A `#` comment needs a line
 * start or whitespace before it, so a JS private field (`this.#x`) or a `#` glued
 * to other text is not read as one (F-15).
 */
export const TODO_PATTERN = /(?:\/\/|\/\*|^\s*\*|(?:^|\s)#)\s*.*?\b(TODO|FIXME|HACK)\b[:\s]?(.*)$/;

/** An env-example assignment line; group 1 is the name (D-8). */
export const ENV_NAME_PATTERN = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/;
