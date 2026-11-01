/**
 * Onboarding Tour (L05) — the application service.
 *
 *   GET  → `getTour`: the stored tour, or a deterministic skeleton built from
 *          git + the index. It NEVER resolves an LLM client and never calls a
 *          model (AC-25, INV-16); it only asks whether the feature's provider
 *          has a key (AC-86, D-42).
 *   POST → `startGeneration`: pre-checks, then ONE `completeStructured` call
 *          run as a `JobRunner` job that outlives the request (AC-21, AC-29).
 *
 * On `JobRunner` (findings F-03): it wraps a handler in `withRetry` and a
 * timeout of its own. The tour handler therefore NEVER throws — every error is
 * recorded as the repo's failure inside the handler — so a retry can never
 * re-call the model (AC-21). If the runner's own timeout fires first (fact
 * collection + a 120 s model call), the job row is marked failed but nothing
 * is retried (a `TimeoutError` is not retryable) and the handler still
 * finishes and records its own outcome. The 409 lock is an in-process map,
 * taken synchronously before the first `await` and released only by the
 * handler itself (INV-17); it assumes one API per database
 * (`server/INSIGHTS.md`), and a restart loses an in-flight generation and
 * stores nothing (R-3).
 *
 * Every dependency arrives through the constructor (INV-9). The index is
 * reached only through a local structural `IndexFacade` — this module never
 * imports the indexer module (INV-2). File content comes only from the git port's
 * `listFilesAt` / `readFileAt` at one sha per generation (D-5, INV-7); nothing
 * is executed and no `.env` other than the example is read (AC-44, AC-64).
 */
import type {
  FeatureModelChoice,
  GitClient,
  LLMProvider,
  OnboardingTour,
  Provider,
  RepoRef,
  TourGeneration,
  TourSections,
} from '@devdigest/shared';
import type { Db } from '../../db/client.js';
import { AppError, ConfigError, NotFoundError } from '../../platform/errors.js';
import { renderPrompt } from '../../platform/prompts.js';
import { withTimeout } from '../../platform/resilience.js';
import {
  EXCERPT_MAX_CHARS,
  FACTS_CACHE_ENTRIES,
  GENERATION_MAX_RETRIES,
  GENERATION_TEMPERATURE,
  GENERATION_TIMEOUT_MS,
  OPEN_PR_LIMIT,
  OUTPUT_MAX_TOKENS,
  READ_MAX_BYTES,
  READING_PATH_SIZE,
  STORED_TOUR_VERSION,
  TODO_SCAN_FILES,
  TOUR_LANGUAGE,
  TOUR_PROMPT_FILE,
  TOUR_JOB_KIND,
  TOUR_SCHEMA_NAME,
} from './constants.js';
import {
  deriveCommands,
  detectStack,
  envExampleNames,
  excerpt,
  findEnvExample,
  findReadme,
  manifestPaths,
  missingTestCandidates,
  openPrCandidates,
  orderCandidates,
  parseManifest,
  scanTodos,
  topLevelFolders,
  type IndexedFile,
  type ManifestFact,
  type TaskCandidate,
  type TourFacts,
} from './facts/helpers.js';
import { classifyGenerationError } from './grounding/helpers.js';
import {
  coveragePartial,
  deriveStatus,
  generatedSections,
  indexReady,
  noCloneSections,
  skeletonSections,
  toTourDto,
  type TourIndexState,
} from './helpers.js';
import { buildUserMessage, fitBudget, renderFactBlocks } from './prompt/helpers.js';
import { OnboardingRepository } from './repository.js';
import { StoredTour, TourNarrative } from './schema.js';

// ---------------------------------------------------------------------------
// What this service needs from the outside, declared here (no cross-module import)
// ---------------------------------------------------------------------------

/** The repo fields the tour reads; `RepoRepository.getById` satisfies it. */
export interface RepoLocator {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  clonePath: string | null;
}

/** The index facade reads the tour uses — structurally a subset of `RepoIntel`. */
export interface IndexFacade {
  getIndexState(repoId: string): Promise<TourIndexState>;
  getIndexedFiles(repoId: string): Promise<IndexedFile[]>;
  /** `getIndexedFiles(repoId).length` as one `count(*)` — status checks only (F-13). */
  countIndexedFiles(repoId: string): Promise<number>;
  getEndpoints(repoId: string): Promise<Array<{ file: string; endpoint: string }>>;
  getTopFilesByRank(repoId: string, n: number): Promise<string[]>;
  getCriticalPaths(repoId: string): Promise<string[][]>;
}

/** The background job queue (structurally `JobRunner`). */
export interface JobQueue {
  register(kind: string, handler: (payload: unknown) => Promise<void>): void;
  enqueue(workspaceId: string, kind: string, payload: unknown): Promise<{ id: string; done: Promise<void> }>;
}

/** Payload of a tour generation job. */
export interface TourJobPayload {
  workspaceId: string;
  repoId: string;
  /** Which `startGeneration` call this job belongs to (F-19). */
  generationId: number;
}

export interface OnboardingServiceDeps {
  db: Db;
  repos: { getById(workspaceId: string, id: string): Promise<RepoLocator | undefined> };
  repoIntel: IndexFacade;
  git: GitClient;
  /** The workspace's "Onboarding Tour" provider + model (AC-22). */
  featureModel: (workspaceId: string) => Promise<FeatureModelChoice>;
  /** Builds the provider client; throws `ConfigError` without a key (AC-70). */
  llm: (provider: Provider) => Promise<LLMProvider>;
  /** Key presence only — builds no client, makes no request (D-42). */
  hasLlmKey: (provider: Provider) => Promise<boolean>;
  /** Runs the generation in the background (F-03). */
  jobs: JobQueue;
  now?: () => Date;
  /** Overrides the 120 s wall around the model call (tests). */
  generationTimeoutMs?: number;
}

type Failure = NonNullable<TourGeneration['failure']>;

/**
 * What the pre-checks resolved, handed from `startGeneration` to the job
 * handler. The index state is NOT handed over: the job may wait in the shared
 * queue while the index refreshes, so the handler re-reads it (F-11).
 */
interface StartedGeneration {
  generationId: number;
  repo: RepoLocator;
  choice: FeatureModelChoice;
  llm: LLMProvider;
}

/** The 409 lock of one repo, owned by one generation (F-19). */
interface GenerationLock {
  generationId: number;
  promise: Promise<void>;
  resolve: () => void;
}

/** Concurrent `git show` processes while collecting facts. */
const READ_CONCURRENCY = 6;

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export class OnboardingService {
  private store: OnboardingRepository;
  /** The 409 lock per repo; released only when the job handler ends (INV-17). */
  private running = new Map<string, GenerationLock>();
  /** Last generation id handed out; unique within this process. */
  private generationSeq = 0;
  /** Pre-checked context waiting for its job to start, per repo. */
  private pending = new Map<string, StartedGeneration>();
  private failures = new Map<string, Failure>();
  /** Git-derived facts per `(repoId, revision, index updatedAt)`, LRU (D-33). */
  private factsCache = new Map<string, TourFacts>();

  constructor(private deps: OnboardingServiceDeps) {
    this.store = new OnboardingRepository(deps.db);
    deps.jobs.register(TOUR_JOB_KIND, (payload) => this.handleJob(payload as TourJobPayload));
  }

  private now(): Date {
    return this.deps.now ? this.deps.now() : new Date();
  }

  // -------------------------------------------------------------------------
  // GET
  // -------------------------------------------------------------------------

  /**
   * The tour for the page (AC-25, INV-16): never calls `deps.llm`, never calls
   * a model, never touches `running`. A valid stored tour is shown whatever the
   * clone and index state since (D-45).
   */
  async getTour(workspaceId: string, repoId: string): Promise<OnboardingTour> {
    const repo = await this.deps.repos.getById(workspaceId, repoId);
    if (!repo) throw new NotFoundError(`Repo ${repoId} not found`);

    const [indexState, storedRow, pulls, choice] = await Promise.all([
      this.deps.repoIntel.getIndexState(repo.id),
      this.store.getStored(repo.id),
      this.store.listOpenPulls(workspaceId, repo.id, OPEN_PR_LIMIT),
      this.deps.featureModel(workspaceId),
    ]);
    const keyMissing = !(await this.deps.hasLlmKey(choice.provider));
    const stored = parseStored(storedRow);
    const prCandidates = openPrCandidates(pulls);

    let sections: TourSections;
    let revision: string | null = null;
    let indexedCount: number;
    if (stored) {
      sections = stored.tour.sections;
      indexedCount = repo.clonePath ? await this.deps.repoIntel.countIndexedFiles(repo.id) : 0;
    } else if (!repo.clonePath) {
      sections = noCloneSections(prCandidates);
      indexedCount = 0;
    } else {
      const facts = await this.collectFacts(repo, indexState);
      sections = skeletonSections(facts, this.candidates(facts, prCandidates));
      revision = facts.revision || null;
      indexedCount = facts.indexed.length;
    }

    const running = this.running.has(repo.id);
    return toTourDto({
      repo,
      status: deriveStatus({
        clonePath: repo.clonePath,
        indexState,
        indexedCount,
        storedValid: stored !== null,
        keyMissing,
        running,
      }),
      sections,
      stored,
      revision,
      currentIndexSha: indexState.lastIndexedSha,
      apiKey: { provider: choice.provider, model: choice.model, missing: keyMissing },
      generation: { running, failure: this.failures.get(repo.id) ?? null },
    });
  }

  // -------------------------------------------------------------------------
  // POST
  // -------------------------------------------------------------------------

  /**
   * Start one generation (AC-27). The lock is taken in the synchronous prefix,
   * before the first `await`, so two calls in the same tick cannot both pass
   * (D-43, INV-17); every pre-check failure releases it. Resolves once the
   * generation has started, with `done` settling when it ends (AC-29).
   */
  async startGeneration(workspaceId: string, repoId: string): Promise<{ done: Promise<void> }> {
    if (this.running.has(repoId)) {
      throw new AppError('tour_generation_running', 'A tour is already being generated', 409);
    }
    this.generationSeq += 1;
    const generationId = this.generationSeq;
    const lock: GenerationLock = { generationId, ...deferred() };
    this.running.set(repoId, lock);

    let started: StartedGeneration;
    try {
      const repo = await this.deps.repos.getById(workspaceId, repoId);
      if (!repo) throw new NotFoundError(`Repo ${repoId} not found`);
      if (!repo.clonePath) {
        throw new AppError('tour_not_cloned', 'The repository is not cloned — clone it to generate a tour', 422);
      }
      const indexState = await this.deps.repoIntel.getIndexState(repo.id);
      const indexedCount = await this.deps.repoIntel.countIndexedFiles(repo.id);
      if (!indexReady(indexState, indexedCount)) {
        throw new AppError('tour_index_not_ready', 'The repository index is not ready', 422, {
          reason: indexState.degradedReason ?? indexState.reason ?? (indexedCount === 0 ? 'not_ranked' : indexState.status),
        });
      }
      const choice = await this.deps.featureModel(workspaceId);
      let llm: LLMProvider;
      try {
        llm = await this.deps.llm(choice.provider);
      } catch (err) {
        if (err instanceof ConfigError) {
          this.failures.set(repo.id, {
            code: 'no_api_key',
            message: `No API key for ${choice.provider}`,
            provider: choice.provider,
            at: this.now().toISOString(),
          });
          throw new AppError('tour_no_api_key', `No API key for ${choice.provider}`, 422, {
            provider: choice.provider,
          });
        }
        throw err;
      }
      started = { generationId, repo, choice, llm };
      this.failures.delete(repoId);
      this.pending.set(repoId, started);
      const payload: TourJobPayload = { workspaceId, repoId, generationId };
      const job = await this.deps.jobs.enqueue(workspaceId, TOUR_JOB_KIND, payload);
      // The handler never throws, so this only fires if the runner's own
      // timeout gave up waiting; the handler still settles the lock itself.
      job.done.catch(() => undefined);
    } catch (err) {
      if (this.pending.get(repoId)?.generationId === generationId) this.pending.delete(repoId);
      this.release(repoId, generationId);
      throw err;
    }
    return { done: lock.promise };
  }

  /** Releases the repo's lock only if `generationId` owns it (F-19). */
  private release(repoId: string, generationId: number): void {
    const lock = this.running.get(repoId);
    if (!lock || lock.generationId !== generationId) return;
    this.running.delete(repoId);
    lock.resolve();
  }

  /**
   * The job handler. It NEVER throws: any error is recorded as the repo's
   * failure here, so `JobRunner`'s retry can never call the model a second
   * time (AC-21, F-03). It releases the lock of its own generation only.
   *
   * A call whose generation is not pending is a `JobRunner` re-run of a
   * handler that already ran (the runner's bookkeeping update threw after the
   * handler resolved — `JobRunner` never resumes jobs across restarts). It
   * does nothing: no second model call, no failure written over the stored
   * outcome, and no release of a newer generation's lock (F-19).
   */
  private async handleJob(payload: TourJobPayload): Promise<void> {
    const repoId = payload?.repoId;
    const started = repoId ? this.pending.get(repoId) : undefined;
    if (!repoId || !started || started.generationId !== payload.generationId) return;
    this.pending.delete(repoId);
    try {
      await this.run(payload.workspaceId, started);
    } catch (err) {
      this.failures.set(repoId, {
        ...classifyGenerationError(err),
        provider: null,
        at: this.now().toISOString(),
      });
    } finally {
      this.release(repoId, started.generationId);
    }
  }

  /**
   * The generation itself: facts → budget → ONE model call → grounding →
   * store. Any error is recorded as the repo's failure and nothing is stored;
   * the previous tour is untouched (AC-71, AC-72, AC-73). Never rejects.
   */
  private async run(workspaceId: string, s: StartedGeneration): Promise<void> {
    const { repo, choice, llm } = s;
    try {
      // Read now, not at POST: the job may have waited in the shared queue
      // while the index refreshed, and the revision, rows and coverage stored
      // below must all describe the same index (F-11).
      const indexState = await this.deps.repoIntel.getIndexState(repo.id);
      const facts = await this.collectFacts(repo, indexState);
      const pulls = await this.store.listOpenPulls(workspaceId, repo.id, OPEN_PR_LIMIT);
      const candidates = this.candidates(facts, openPrCandidates(pulls));
      const { text, trimmed } = fitBudget(renderFactBlocks(facts, candidates));
      const system = await renderPrompt(TOUR_PROMPT_FILE, { language: TOUR_LANGUAGE });
      const timeoutMs = this.deps.generationTimeoutMs ?? GENERATION_TIMEOUT_MS;

      // The one model call of a generation (AC-21, AC-83, INV-4). The outer
      // wall is needed because not every adapter honours `timeoutMs` (D-21).
      const result = await withTimeout(
        llm.completeStructured({
          model: choice.model,
          schema: TourNarrative,
          schemaName: TOUR_SCHEMA_NAME,
          temperature: GENERATION_TEMPERATURE,
          maxTokens: OUTPUT_MAX_TOKENS,
          timeoutMs,
          maxRetries: GENERATION_MAX_RETRIES,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: buildUserMessage(repo.fullName, text) },
          ],
        }),
        timeoutMs,
      );

      const envelope: StoredTour = {
        v: STORED_TOUR_VERSION,
        revision: facts.revision,
        // What `outdated` compares with: the index sha, even when the facts
        // had to be read at HEAD instead (F-12).
        index_sha: indexState.lastIndexedSha,
        index_files: facts.indexed.length,
        source_files: indexState.coverage?.totalSourceFiles ?? null,
        coverage_partial: coveragePartial(indexState),
        index_partial: indexState.status === 'partial',
        trimmed,
        provider: choice.provider,
        model: choice.model,
        cost_usd: result.costUsd,
        sections: generatedSections(facts, candidates, result.data),
      };
      await this.store.upsert(repo.id, envelope, this.now());
      this.failures.delete(repo.id);
    } catch (err) {
      this.failures.set(repo.id, {
        ...classifyGenerationError(err),
        provider: choice.provider,
        at: this.now().toISOString(),
      });
    }
  }

  // -------------------------------------------------------------------------
  // Facts
  // -------------------------------------------------------------------------

  private candidates(facts: TourFacts, prCandidates: TaskCandidate[]): TaskCandidate[] {
    const rankIndex = new Map(facts.indexed.map((f, i) => [f.path, i]));
    return orderCandidates(facts.fileCandidates, prCandidates, rankIndex, facts.indexed);
  }

  /**
   * Everything git and the index say about one revision (AC-20, AC-68). The
   * revision is the index's sha, else HEAD (D-5); if the tree at that sha is
   * gone, HEAD is used for the whole set. A failed read leaves that fact out —
   * it never throws. `readFileAt` is called only on `package.json` paths, the
   * README, the env example and the top-30 ranked files; lockfiles and compose
   * files are recognised by name (AC-68, AC-64).
   */
  private async collectFacts(repo: RepoLocator, indexState: TourIndexState): Promise<TourFacts> {
    const ref: RepoRef = { owner: repo.owner, name: repo.name };
    const head = async () => {
      try {
        return await this.deps.git.currentHead(ref);
      } catch {
        return '';
      }
    };

    let revision = indexState.lastIndexedSha || (await head());
    const key = JSON.stringify([repo.id, revision, indexState.updatedAt.getTime()]);
    const cached = this.factsCache.get(key);
    if (cached) {
      this.factsCache.delete(key);
      this.factsCache.set(key, cached);
      return cached;
    }

    // Blob sizes from `ls-tree -l`, so an oversized blob is refused before it
    // is read (F-18).
    let sizes = new Map<string, number>();
    const list = async (sha: string) =>
      new Map((await this.deps.git.listFilesAt(ref, sha)).map((f) => [f.path, f.size] as const));
    if (revision) {
      try {
        sizes = await list(revision);
      } catch {
        const current = indexState.lastIndexedSha ? await head() : '';
        if (current && current !== revision) {
          revision = current;
          try {
            sizes = await list(revision);
          } catch {
            sizes = new Map();
          }
        }
      }
    }
    const treePaths = [...sizes.keys()];

    // One ranked read: the reading path is the head of the same junk-filtered
    // top list the TODO scan uses (F-14).
    const [indexed, topPaths, chains, endpoints] = await Promise.all([
      this.deps.repoIntel.getIndexedFiles(repo.id),
      this.deps.repoIntel.getTopFilesByRank(repo.id, Math.max(READING_PATH_SIZE, TODO_SCAN_FILES)),
      this.deps.repoIntel.getCriticalPaths(repo.id),
      this.deps.repoIntel.getEndpoints(repo.id),
    ]);
    const readingPaths = topPaths.slice(0, READING_PATH_SIZE);
    const scanPaths = topPaths.slice(0, TODO_SCAN_FILES);
    const indexedPaths = indexed.map((f) => f.path);

    /** The whole blob, at most `READ_MAX_BYTES`; each use site cuts its own excerpt. */
    const read = async (path: string): Promise<string | null> => {
      const size = sizes.get(path);
      if (!revision || size === undefined || size > READ_MAX_BYTES) return null;
      try {
        return await this.deps.git.readFileAt(ref, revision, path);
      } catch {
        return null;
      }
    };

    const manifestRefs = manifestPaths(treePaths, indexedPaths);
    const readmePath = findReadme(treePaths);
    const envPath =
      [...new Set(['', ...manifestRefs.map((m) => m.dir)])]
        .map((dir) => findEnvExample(dir, treePaths))
        .find((p): p is string => p !== null) ?? null;

    const manifestTexts = await mapLimit(manifestRefs, READ_CONCURRENCY, (m) => read(m.path));
    const [readmeText, envText] = await Promise.all([
      readmePath ? read(readmePath) : Promise.resolve(null),
      envPath ? read(envPath) : Promise.resolve(null),
    ]);
    const scanTexts = await mapLimit(scanPaths, READ_CONCURRENCY, (p) => read(p));

    const manifests: ManifestFact[] = [];
    manifestRefs.forEach((m, i) => {
      const text = manifestTexts[i];
      // Parsed from the whole file: a `package.json` longer than the excerpt
      // is not valid JSON once cut (F-08). Only the prompt copy is cut.
      if (text != null) manifests.push({ dir: m.dir, path: m.path, text: excerpt(text), parsed: parseManifest(text) });
    });

    const fileCandidates: TaskCandidate[] = [
      ...scanPaths.flatMap((p, i) => (scanTexts[i] != null ? scanTodos(p, scanTexts[i]!) : [])),
      ...missingTestCandidates(scanPaths, treePaths),
    ];

    const facts: TourFacts = {
      revision,
      treePaths,
      indexed,
      readingPaths,
      scanPaths,
      chains,
      endpoints,
      manifests,
      readme: readmePath && readmeText != null ? { path: readmePath, text: readmeText.slice(0, EXCERPT_MAX_CHARS) } : null,
      envExample: envPath && envText != null ? { path: envPath, names: envExampleNames(excerpt(envText)) } : null,
      fileCandidates,
      commands: deriveCommands({ treePaths, manifests }),
      stack: detectStack({ indexedPaths, manifests, treePaths }),
      folders: topLevelFolders(indexedPaths),
    };

    this.factsCache.set(key, facts);
    while (this.factsCache.size > FACTS_CACHE_ENTRIES) {
      const oldest = this.factsCache.keys().next().value;
      if (oldest === undefined) break;
      this.factsCache.delete(oldest);
    }
    return facts;
  }
}

/** A stored row whose envelope parses, else `null` ("no stored tour", D-4). */
function parseStored(
  row: { json: unknown; generatedAt: Date } | undefined,
): { tour: StoredTour; generatedAt: Date } | null {
  if (!row) return null;
  const parsed = StoredTour.safeParse(row.json);
  return parsed.success ? { tour: parsed.data, generatedAt: row.generatedAt } : null;
}
