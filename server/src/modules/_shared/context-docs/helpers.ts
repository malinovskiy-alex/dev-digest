import { z } from 'zod';

/**
 * The project-context path rule — Ring 1, pure. Shared by project-context
 * (listing, content, prompt resolution), agents and skills (attachment
 * validation), so it lives in `_shared`, the one folder all three may import.
 */

/**
 * Directories whose markdown never counts as a project document. A copy of
 * `repo-intel/constants.ts` `EXCLUDED_DIRS` (`no-cross-module` forbids the
 * import); a unit test pins that the two lists stay equal.
 */
export const CONTEXT_DOC_EXCLUDED_DIRS = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  'out',
  'vendor',
  '.git',
] as const;

/**
 * Where project documents are searched for (R-74): a markdown file inside a
 * `specs/`, `docs/` or `insights/` folder at any depth. Overridden by
 * `CONTEXT_DOC_GLOBS` (`AppConfig.contextDocGlobs`).
 */
export const DEFAULT_CONTEXT_DOC_GLOBS: readonly string[] = ['**/{specs,docs,insights}/**/*.md'];

/** Category of a document under no search-root folder. */
export const ROOT_CATEGORY = 'root';

/** Max path length accepted anywhere a document path enters the system. */
export const MAX_CONTEXT_DOC_PATH_LENGTH = 1024;

/** Max attachments one agent or skill may store (one PUT body). */
export const MAX_CONTEXT_DOC_LINKS = 500;

const EXCLUDED = new Set<string>(CONTEXT_DOC_EXCLUDED_DIRS);

/**
 * A repo-relative POSIX path to a markdown document outside the excluded
 * directories. Syntactic only: membership in the tree is checked separately.
 * The `.md` extension is matched case-insensitively (`README.MD` counts).
 */
export function isContextDocPath(path: string): boolean {
  if (path.length === 0 || path.length > MAX_CONTEXT_DOC_PATH_LENGTH) return false;
  if (!path.toLowerCase().endsWith('.md')) return false;
  if (path.startsWith('/') || path.startsWith('-')) return false;
  if (path.includes('\\') || path.includes(':') || path.includes('\0')) return false;
  const segments = path.split('/');
  // Excluded directories match case-insensitively, like the `.md` extension:
  // `Vendor/`, `Build/` and `Node_Modules/` are excluded too (R-03).
  return segments.every(
    (seg) => seg !== '' && seg !== '.' && seg !== '..' && !EXCLUDED.has(seg.toLowerCase()),
  );
}

/**
 * A minimal glob → RegExp: `**` as a whole segment matches zero or more
 * folders, `*` and `?` stay inside one segment, `{a,b}` is an alternation.
 * Case-insensitive, like the `.md` and excluded-folder checks. The server ships
 * no glob library, and this is the whole grammar `CONTEXT_DOC_GLOBS` needs.
 */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  let braces = 0;
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    const segmentStart = i === 0 || glob[i - 1] === '/';
    if (c === '*' && glob[i + 1] === '*' && segmentStart && glob[i + 2] === '/') {
      re += '(?:[^/]+/)*';
      i += 2;
    } else if (c === '*' && glob[i + 1] === '*' && segmentStart && i + 2 === glob.length) {
      re += '.*';
      i += 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '{') {
      braces++;
      re += '(?:';
    } else if (c === '}' && braces > 0) {
      braces--;
      re += ')';
    } else if (c === ',' && braces > 0) re += '|';
    else re += /[.+^$()|[\]\\]/.test(c) ? `\\${c}` : c;
  }
  return new RegExp(`^${re}$`, 'i');
}

/** The literal folder names in the globs (`{specs,docs,insights}` → three), lower-cased. */
export function globRootNames(globs: readonly string[]): Set<string> {
  const names = new Set<string>();
  for (const glob of globs) {
    for (const seg of glob.split('/').slice(0, -1)) {
      if (/[*?]/.test(seg)) continue;
      const alts = /^\{(.*)\}$/.exec(seg)?.[1]?.split(',') ?? [seg];
      for (const alt of alts) if (alt) names.add(alt.toLowerCase());
    }
  }
  return names;
}

const DEFAULT_ROOT_NAMES = globRootNames(DEFAULT_CONTEXT_DOC_GLOBS);

/**
 * The category of a document (R-09): the first folder of its path that is a
 * search-root folder, lower-cased so `Docs/` and `docs/` are one category
 * (`server/docs/a.md` → `docs`), else its first folder, else `root`.
 */
export function docCategory(path: string, rootNames: ReadonlySet<string> = DEFAULT_ROOT_NAMES): string {
  const folders = path.split('/').slice(0, -1);
  const root = folders.find((f) => rootNames.has(f.toLowerCase()));
  return root?.toLowerCase() ?? folders[0] ?? ROOT_CATEGORY;
}

/** Which tree paths are project documents, and their category, for one set of globs. */
export interface ContextDocMatcher {
  matches(path: string): boolean;
  category(path: string): string;
}

/** A tree path is a project document when it passes `isContextDocPath` AND matches a glob (R-74). */
export function createContextDocMatcher(globs: readonly string[] = DEFAULT_CONTEXT_DOC_GLOBS): ContextDocMatcher {
  const res = globs.map(globToRegExp);
  const roots = globRootNames(globs);
  return {
    matches: (path) => isContextDocPath(path) && res.some((re) => re.test(path)),
    category: (path) => docCategory(path, roots),
  };
}

/** A document path at a system boundary (route body / querystring). */
export const ContextDocPath = z.string().refine(isContextDocPath, 'not a project-context document path');

/** True when no path appears twice (a repeat collides with the `(owner_id, path)` key). */
export function uniquePaths(paths: string[]): boolean {
  return new Set(paths).size === paths.length;
}

/**
 * `PUT /agents/:id/context-docs` and `PUT /skills/:id/context-docs`: the whole
 * ordered list, with a flag per row (replace semantics). A repeated path is bad
 * input, so it fails validation with a 422 instead of reaching the insert.
 */
export const ContextDocLinksBody = z
  .object({
    docs: z
      .array(z.object({ path: ContextDocPath, enabled: z.boolean() }))
      .max(MAX_CONTEXT_DOC_LINKS),
  })
  .refine((b) => uniquePaths(b.docs.map((d) => d.path)), {
    message: 'document paths must be unique',
    path: ['docs'],
  });
export type ContextDocLinksBody = z.infer<typeof ContextDocLinksBody>;
