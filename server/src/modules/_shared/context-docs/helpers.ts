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

/** Category of a document that sits at the repo root (`README.md`). */
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

/** First folder of the path; `root` for a file at the repo root. */
export function docCategory(path: string): string {
  const slash = path.indexOf('/');
  return slash > 0 ? path.slice(0, slash) : ROOT_CATEGORY;
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
