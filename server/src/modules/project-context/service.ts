import type {
  ContextDocContent,
  ContextDocList,
  GitClient,
  RepoRef,
} from '@devdigest/shared';
import { AppError, NotFoundError, ValidationError } from '../../platform/errors.js';
import {
  createContextDocMatcher,
  isContextDocPath,
  type ContextDocMatcher,
} from '../_shared/context-docs/helpers.js';
import {
  CONTENT_CACHE_ENTRIES,
  CONTEXT_DOC_NOT_FOUND,
  CONTEXT_DOC_TOO_LARGE,
  CONTEXT_NOT_CLONED,
  LIST_CACHE_ENTRIES,
  MAX_CONTEXT_DOC_VIEW_BYTES,
  MAX_CONTEXT_TOTAL_CHARS,
  MAX_LISTED_DOCS,
  PROMPT_READ_CONCURRENCY,
} from './constants.js';
import {
  applyPromptBudget,
  budgetChars,
  mergePromptDocs,
  toContextDoc,
  truncateForPrompt,
  type PromptDocRefs,
} from './helpers.js';

/** What the service needs to know about a repo. `RepoRow` satisfies it structurally. */
export interface RepoLocator {
  owner: string;
  name: string;
  clonePath: string | null;
}

export interface ProjectContextServiceDeps {
  git: GitClient;
  repos: { getById(workspaceId: string, id: string): Promise<RepoLocator | undefined> };
  /** "Used by N" per path for a workspace (agents repository, one grouped query). */
  usage: (workspaceId: string) => Promise<Map<string, number>>;
  /** Where documents are searched for (R-74); `DEFAULT_CONTEXT_DOC_GLOBS` when omitted. */
  docGlobs?: readonly string[];
}

export type ContextSkipReason = 'not_found' | 'not_cloned' | 'read_error' | 'budget';

/** One document resolved for a prompt. */
export interface ResolvedContextDoc {
  path: string;
  /** The text that goes into the prompt — already truncated when `truncated`. */
  text: string;
  /** Length of the document as stored, before truncation. */
  chars: number;
  truncated: boolean;
}

export interface ResolvedContext {
  docs: ResolvedContextDoc[];
  skipped: { path: string; reason: ContextSkipReason }[];
}

/** The context-doc part of a tree at one sha: immutable, so cacheable forever. */
interface Listing {
  /** Every context-doc path in the tree (uncapped), path asc. */
  paths: string[];
  /** Blob size in bytes per path, straight from `ls-tree -l` — no blob is read to list. */
  sizes: Map<string, number>;
}

/**
 * project-context — lists, reads and resolves the repo's markdown documents.
 *
 * Everything comes from git objects at ONE sha (`currentHead()` of the local
 * clone): the tree and the sizes via `listFilesAt` (`ls-tree -l`), the content
 * via `readFileAt`. Nothing reads the working tree, so a symlinked `.md`
 * (dropped by `listFilesAt`) can never serve a file from outside the repo.
 * Refresh (R-06) is just another GET: HEAD is re-resolved every time and an
 * unchanged sha is answered from cache.
 *
 * Both caches hold only successful results (a failed git call is evicted, so
 * the next request retries) and capture no request-scoped object.
 */
export class ProjectContextService {
  private listings = new Map<string, Promise<Listing>>();
  /** Prompt-ready (already cut) text per `repo@sha:path`, shared by every agent of a run. */
  private prompts = new Map<string, Promise<{ text: string; chars: number; truncated: boolean }>>();

  private matcher: ContextDocMatcher;

  constructor(private deps: ProjectContextServiceDeps) {
    this.matcher = createContextDocMatcher(deps.docGlobs);
  }

  /** The Project Context page's listing (R-02, R-07, R-08, R-12, R-66, D-REC5). */
  async listDocs(workspaceId: string, repoId: string): Promise<ContextDocList> {
    const repo = await this.requireRepo(workspaceId, repoId);
    const listedAt = new Date().toISOString();
    if (!repo.clonePath) {
      return { cloned: false, sha: null, listed_at: listedAt, total: 0, capped: false, docs: [] };
    }
    const ref = toRef(repo);
    const sha = await this.deps.git.currentHead(ref);
    const [listing, usage] = await Promise.all([this.listing(ref, sha), this.deps.usage(workspaceId)]);
    // Sizes come from the tree (bytes): no blob is read to build the list. For
    // ASCII markdown bytes == characters; otherwise it is a slight overestimate,
    // which is the safe side for a token estimate.
    const docs = listing.paths
      .slice(0, MAX_LISTED_DOCS)
      .map((path) => toContextDoc(path, listing.sizes.get(path) ?? 0, usage.get(path) ?? 0, this.matcher.category(path)));
    return {
      cloned: true,
      sha,
      listed_at: listedAt,
      total: listing.paths.length,
      capped: listing.paths.length > MAX_LISTED_DOCS,
      docs,
    };
  }

  /** One document's content at HEAD (R-04, R-14, R-16). */
  async readDoc(workspaceId: string, repoId: string, path: string): Promise<ContextDocContent> {
    if (!isContextDocPath(path)) throw new ValidationError('Not a project-context document path');
    const repo = await this.requireRepo(workspaceId, repoId);
    if (!repo.clonePath) {
      throw new AppError(CONTEXT_NOT_CLONED, 'The repository has not been cloned yet', 409);
    }
    const ref = toRef(repo);
    const sha = await this.deps.git.currentHead(ref);
    const listing = await this.listing(ref, sha);
    // Membership in the FULL tree, not the capped listing: a doc past the cap
    // is still readable (D-REC5).
    const size = listing.sizes.get(path);
    if (size === undefined) {
      throw new AppError(CONTEXT_DOC_NOT_FOUND, 'Document not found at the current HEAD', 404, { path });
    }
    // Refused before the blob is read: the viewer is for documents, not dumps.
    if (size > MAX_CONTEXT_DOC_VIEW_BYTES) {
      throw new AppError(CONTEXT_DOC_TOO_LARGE, 'Document is too large to display', 413, {
        path,
        size,
        max: MAX_CONTEXT_DOC_VIEW_BYTES,
      });
    }
    const content = await this.deps.git.readFileAt(ref, sha, path);
    return { path, sha, content, chars: content.length };
  }

  /**
   * The documents one agent's review puts into its prompt, in R-46 order,
   * each once, within the section budget (R-73). NEVER throws on a git
   * problem: a document that cannot be used is reported in `skipped` with its
   * reason and the review goes on (R-50, R-51).
   */
  async resolveForPrompt(repo: RepoLocator, refs: PromptDocRefs): Promise<ResolvedContext> {
    const merged = mergePromptDocs(refs);
    if (merged.length === 0) return { docs: [], skipped: [] };
    if (!repo.clonePath) {
      return { docs: [], skipped: merged.map((m) => ({ path: m.path, reason: 'not_cloned' as const })) };
    }
    const ref = toRef(repo);
    let sha: string;
    let listing: Listing;
    try {
      sha = await this.deps.git.currentHead(ref);
      listing = await this.listing(ref, sha);
    } catch {
      return { docs: [], skipped: merged.map((m) => ({ path: m.path, reason: 'read_error' as const })) };
    }

    // Read every present document in parallel (bounded), keeping R-46 order.
    type Read = ResolvedContextDoc | { path: string; reason: ContextSkipReason };
    const reads: Read[] = await mapBounded(merged, PROMPT_READ_CONCURRENCY, async ({ path }) => {
      if (!listing.sizes.has(path)) return { path, reason: 'not_found' as const };
      try {
        return { path, ...(await this.promptText(ref, sha, path)) };
      } catch {
        return { path, reason: 'read_error' as const };
      }
    });

    const present: ResolvedContextDoc[] = [];
    const skipped: ResolvedContext['skipped'] = [];
    for (const r of reads) {
      if ('reason' in r) skipped.push(r);
      else present.push(r);
    }
    // Counted on document text only, not the truncation marker (F-29).
    const { kept, over } = applyPromptBudget(present, MAX_CONTEXT_TOTAL_CHARS, budgetChars);
    for (const d of over) skipped.push({ path: d.path, reason: 'budget' });
    // Skips listed in prompt order too, so the trace reads top to bottom.
    const order = new Map(merged.map((m, i) => [m.path, i]));
    skipped.sort((a, b) => (order.get(a.path) ?? 0) - (order.get(b.path) ?? 0));
    return { docs: kept, skipped };
  }

  private async requireRepo(workspaceId: string, repoId: string): Promise<RepoLocator> {
    const repo = await this.deps.repos.getById(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    return repo;
  }

  /** The tree's context-doc paths + sizes at `sha`, memoised (REC-2). A failed read is not cached. */
  private listing(ref: RepoRef, sha: string): Promise<Listing> {
    return memo(this.listings, `${ref.owner}/${ref.name}@${sha}`, LIST_CACHE_ENTRIES, async () => {
      const files = await this.deps.git.listFilesAt(ref, sha);
      // Only paths under a search root (R-74): a `.md` elsewhere is not listed,
      // not readable (404) and skipped as `not_found` in a prompt.
      const docs = files.filter((f) => this.matcher.matches(f.path));
      docs.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
      return { paths: docs.map((d) => d.path), sizes: new Map(docs.map((d) => [d.path, d.size])) };
    });
  }

  /** A document's prompt-ready text at `sha`, memoised so a multi-agent run reads each blob once. */
  private promptText(ref: RepoRef, sha: string, path: string) {
    return memo(this.prompts, `${ref.owner}/${ref.name}@${sha}:${path}`, CONTENT_CACHE_ENTRIES, async () => {
      const raw = await this.deps.git.readFileAt(ref, sha, path);
      const { text, truncated } = truncateForPrompt(raw);
      return { text, chars: raw.length, truncated };
    });
  }
}

function toRef(repo: RepoLocator): RepoRef {
  return { owner: repo.owner, name: repo.name };
}

/**
 * Bounded LRU memo of promises. A rejected promise is evicted, so a transient
 * git failure is retried by the next caller instead of being served forever.
 */
function memo<T>(cache: Map<string, Promise<T>>, key: string, max: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key); // refresh recency: Map iteration order is insertion order
    cache.set(key, hit);
    return hit;
  }
  const pending = load();
  cache.set(key, pending);
  pending.catch(() => {
    if (cache.get(key) === pending) cache.delete(key);
  });
  while (cache.size > max) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return pending;
}

/** `Promise.all(items.map(fn))` with at most `limit` in flight; results keep input order. */
async function mapBounded<I, O>(items: I[], limit: number, fn: (item: I) => Promise<O>): Promise<O[]> {
  const out = new Array<O>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
