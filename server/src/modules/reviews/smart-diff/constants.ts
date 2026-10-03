/**
 * Smart Diff constants — the literal pattern data behind `classifyFile`.
 *
 * Every list here is matched with plain string operations (`endsWith`,
 * `startsWith`, `includes`, `===`) on a normalised path. Nothing is turned
 * into a RegExp: file paths come from GitHub and are attacker-influenced.
 */
import type { SmartDiffRole } from '@devdigest/shared';

/** Display order of the groups: core → tests → wiring → docs → boilerplate. */
export const ROLE_ORDER: readonly SmartDiffRole[] = [
  'core',
  'tests',
  'wiring',
  'docs',
  'boilerplate',
];

/**
 * The order the classifier checks the roles in; the first match wins and
 * `core` is the fallback. NOT the display order: boilerplate must beat tests
 * (a snapshot under `__tests__/`), tests must beat docs (`e2e/README.md`) and
 * wiring must beat docs (`.claude/skills/x/SKILL.md`).
 */
export const CLASSIFY_PRECEDENCE = ['boilerplate', 'tests', 'wiring', 'docs'] as const;

// ---- boilerplate ----

/** Lock-files that do not end in `.lock`. */
export const LOCKFILE_BASENAMES: readonly string[] = [
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
];
/** Basename suffixes of generated or mechanical files (`Cargo.lock`, `x.snap`, `vendor.min.js`). */
export const BOILERPLATE_SUFFIXES: readonly string[] = ['.lock', '.snap', '.min.js'];
/** Basename infix of code generators' output (`api.generated.ts`). */
export const BOILERPLATE_INFIXES: readonly string[] = ['.generated.'];
/** Build output — matched only as the FIRST path segment, so `src/build/` stays core. */
export const BOILERPLATE_ROOT_DIRS: readonly string[] = ['dist', 'build'];
/** Directories of generated files, matched at any depth. */
export const BOILERPLATE_ANY_DIRS: readonly string[] = ['__snapshots__'];

// ---- tests ----

/** Test-file basename suffixes; `.it.test.ts` is covered by `.test.ts`. */
export const TEST_SUFFIXES: readonly string[] = [
  '.test.ts',
  '.test.tsx',
  '.test.js',
  '.test.jsx',
  '.spec.ts',
  '.spec.tsx',
  '.spec.js',
  '.spec.jsx',
];
/** Test directories, matched at any depth. */
export const TEST_ANY_DIRS: readonly string[] = ['test', 'tests', '__tests__'];
/** Browser-flow packages — matched only as the FIRST path segment. */
export const TEST_ROOT_DIRS: readonly string[] = ['e2e'];

// ---- wiring ----

/** Exact basenames that only wire code together (`package.json` at any depth, D-10). */
export const WIRING_BASENAMES: readonly string[] = ['index.ts', 'index.js', 'package.json'];
/** Basename infix of tool configuration (`vitest.config.ts`). */
export const WIRING_INFIXES: readonly string[] = ['.config.'];
/** Basename prefixes of tool configuration and environment files. */
export const WIRING_PREFIXES: readonly string[] = ['.eslintrc', '.env'];
/** `prefix*suffix` basename pairs: `tsconfig*.json`, `docker-compose*.yml|yaml`. */
export const WIRING_PREFIX_SUFFIX: readonly (readonly [string, string])[] = [
  ['tsconfig', '.json'],
  ['docker-compose', '.yml'],
  ['docker-compose', '.yaml'],
];
/** Tooling directories, matched at any depth. */
export const WIRING_ANY_DIRS: readonly string[] = ['.github', '.claude'];

// ---- docs ----

/** Documentation extensions, compared on the lower-cased basename. */
export const DOCS_SUFFIXES: readonly string[] = ['.md', '.mdx'];
/** Documentation basename prefixes, compared case-insensitively (lower-case here). */
export const DOCS_PREFIXES: readonly string[] = ['readme', 'changelog', 'license'];
/** Documentation directories, matched at any depth. */
export const DOCS_ANY_DIRS: readonly string[] = ['docs'];
