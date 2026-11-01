/**
 * PR Brief (L05) — the application service.
 *
 *   GET  → `getView`: the stored brief plus what is computed at read time
 *          (stale, generating, last failure, key presence). It NEVER resolves
 *          an LLM client, never calls a model and never enqueues (R-03, INV-6).
 *   POST → `startGeneration`: pre-checks, then ONE `completeStructured` call
 *          run as a `JobRunner` job that outlives the request (R-74, D-6).
 *
 * On `JobRunner` (D-6, D-39): it wraps a handler in `withRetry` and a 120 s
 * wall of its own. The brief handler therefore NEVER rejects — every error is
 * recorded as the PR's failure inside it — and it CLAIMS its generation
 * synchronously on entry, so a re-invocation (after the runner's wall fired
 * while a 120 s reasoning call was still running) finds nothing and returns:
 * the model is never called twice (R-12, R-17). On top of that the call's
 * own timeout is cut to what is left of that wall after fact collection,
 * minus a margin (F-12), so the handler normally settles before the runner
 * gives up on it — the `jobs` row reads `done` and the queue slot is not
 * freed while a model call still runs. `jobs.ts` is unchanged.
 *
 * The 409 lock is an in-process map, checked and set in one synchronous
 * segment (INV-7); it assumes one API process per database
 * (`server/INSIGHTS.md`). A restart loses an in-flight generation and stores
 * nothing (plan R-3).
 *
 * Every dependency arrives through the constructor (INV-11); the deps expose
 * reads only — no intent derive, no index rebuild, no PR sync (R-10, INV-4).
 */
import type {
  BriefFailure,
  BriefMissingInput,
  FeatureModelChoice,
  LLMProvider,
  PrBriefView,
  Provider,
  SmartDiffRole,
  StructuredResult,
} from '@devdigest/shared';
import { sectionMeta } from '@devdigest/reviewer-core';
import type { Db } from '../../db/client.js';
import { AppError, ConfigError, NotFoundError } from '../../platform/errors.js';
import { logPromptAssembly } from '../../platform/prompt-log.js';
import { renderPrompt } from '../../platform/prompts.js';
import { TimeoutError, withTimeout } from '../../platform/resilience.js';
import {
  BRIEF_JOB_KIND,
  BRIEF_NO_KEY,
  BRIEF_PROMPT_FILE,
  BRIEF_RUNNING,
  BRIEF_SCHEMA_NAME,
  GENERATION_MAX_RETRIES,
  GENERATION_TEMPERATURE,
  JOB_NOT_STARTED_MESSAGE,
  JOB_WALL_MARGIN_MS,
  JOB_WALL_MS,
  PULL_NOT_FOUND_MESSAGE,
  RUNNING_MESSAGE,
  SPEC_READ_CONCURRENCY,
  VIEW_STATE_TTL_MS,
} from './constants.js';
import {
  callDeadlineMs,
  classifyGenerationError,
  failureLogFields,
  groundAnswer,
  InvalidOutputError,
  ModelCallError,
  StoreFailedError,
  validateAnswer,
  type GroundedAnswer,
} from './grounding/helpers.js';
import { callLimits, noKeyMessage, parseStoredBrief, toStoredBrief, toView } from './helpers.js';
import {
  blastMissing,
  cutIssueBody,
  descriptionMissing,
  diffMissing,
  flattenCallers,
  groundingContext,
  intentMissing,
  missingInput,
  normalizeDescription,
  orderMissing,
  parseClosingIssues,
  specsMissing,
  toDiffRows,
  unionSpecPaths,
} from './inputs/helpers.js';
import { fitBudget, toSectionMeta, type FittedPrompt } from './prompt/helpers.js';
import { BriefRepository } from './repository.js';
import { BriefModelAnswer } from './schema.js';
import type {
  BriefAgentDocs,
  BriefBlastSource,
  BriefContextSource,
  BriefFacts,
  BriefIssue,
  BriefIssueSource,
  BriefJobPayload,
  BriefJobQueue,
  BriefLogger,
  BriefPull,
  BriefPullSource,
  BriefRepo,
  BriefSkillDocs,
  BriefSpec,
} from './types.js';

/**
 * Everything the service needs, injected (INV-4, INV-11). Declared here, not
 * in `types.ts`, because it names the Ring-3 `Db` (F-01); every port it holds
 * is a Ring-1 structural interface from `types.ts`.
 */
export interface BriefServiceDeps {
  db: Db;
  pulls: BriefPullSource;
  blast: BriefBlastSource;
  /** The Smart Diff role of a changed path. */
  fileRole: (path: string) => SmartDiffRole;
  agents: BriefAgentDocs;
  skills: BriefSkillDocs;
  projectContext: BriefContextSource;
  /** Throws `ConfigError` without a token (→ missing `github_unavailable`). */
  github: () => Promise<BriefIssueSource>;
  /** The workspace's "Risk Brief" provider + model (R-11). */
  featureModel: (workspaceId: string) => Promise<FeatureModelChoice>;
  /** Key presence only — builds no client, makes no request (R-68). */
  hasLlmKey: (provider: Provider) => Promise<boolean>;
  /** Builds the provider client; throws `ConfigError` without a key. */
  llm: (provider: Provider) => Promise<LLMProvider>;
  jobs: BriefJobQueue;
  /** The app logger: a generation outlives its request. */
  logger: BriefLogger;
  promptLogVerbose: boolean;
  now?: () => Date;
  /** Overrides the outer wall around the model call (tests). */
  generationTimeoutMs?: number;
}

/** Runs `fn` over `items` with at most `limit` in flight, keeping order (F-08). */
async function mapBounded<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
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

/** What the pre-checks resolved, handed from `startGeneration` to the job handler (D-7). */
interface StartedGeneration {
  generationId: number;
  workspaceId: string;
  choice: FeatureModelChoice;
  llm: LLMProvider;
}

/** The outcome of the issue read (R-64, D-14). */
interface IssueRead {
  issue: BriefIssue | null;
  missing: BriefMissingInput | null;
}

/** The outcome of the specs read (R-65, D-15). */
interface SpecsRead {
  specs: BriefSpec[];
  missing: BriefMissingInput | null;
  budgetSkipped: string[];
  skips: Array<{ path: string; reason: string }>;
}

export class BriefService {
  private store: BriefRepository;
  /** The 409 lock per PR, owned by one generation (D-7). */
  private running = new Map<string, { generationId: number }>();
  /** Pre-checked generations waiting for their job handler, per PR (D-7, D-39). */
  private started = new Map<string, StartedGeneration>();
  /** The last failure per PR; cleared when the next generation is accepted (R-75). */
  private failures = new Map<string, BriefFailure>();
  /** Last generation id handed out; unique within this process. */
  private seq = 0;
  /**
   * The feature model and key presence last read per workspace (F-17). Only a
   * GET made while a generation runs — the client's 2 s poll — reuses it, for
   * at most `VIEW_STATE_TTL_MS`; every other GET reads both afresh.
   */
  private viewState = new Map<string, { choice: FeatureModelChoice; keyAvailable: boolean; at: number }>();

  constructor(private deps: BriefServiceDeps) {
    this.store = new BriefRepository(deps.db);
    deps.jobs.register(BRIEF_JOB_KIND, (payload) => this.handleJob(payload as BriefJobPayload));
  }

  private now(): Date {
    return this.deps.now ? this.deps.now() : new Date();
  }

  private async requirePull(workspaceId: string, prId: string): Promise<BriefPull> {
    const pull = await this.deps.pulls.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError(PULL_NOT_FOUND_MESSAGE);
    return pull;
  }

  // -------------------------------------------------------------------------
  // GET
  // -------------------------------------------------------------------------

  /**
   * The brief for the Overview (R-02, R-03, R-43). Two reads plus a key
   * presence check; never `llm()`, never a model, never `enqueue`, never a
   * write to `running` (INV-6).
   */
  async getView(workspaceId: string, prId: string): Promise<PrBriefView> {
    const pull = await this.requirePull(workspaceId, prId);
    // Generation state BEFORE the stored row: a generation writes its row and
    // only then releases its lock, so "not generating" seen here means the row
    // read below already holds its outcome (as onboarding F-50).
    const generating = this.running.has(pull.id);
    const failure = this.failures.get(pull.id) ?? null;
    const [json, { choice, keyAvailable }] = await Promise.all([
      this.store.get(pull.id),
      this.readViewState(workspaceId, generating),
    ]);
    return toView({
      stored: parseStoredBrief(json),
      headSha: pull.headSha,
      generating,
      failure,
      keyAvailable,
      choice,
    });
  }

  /** Settings + secrets reads for the view; cached only while polling (F-17). */
  private async readViewState(
    workspaceId: string,
    generating: boolean,
  ): Promise<{ choice: FeatureModelChoice; keyAvailable: boolean }> {
    const cached = this.viewState.get(workspaceId);
    if (generating && cached && Date.now() - cached.at < VIEW_STATE_TTL_MS) return cached;
    const choice = await this.deps.featureModel(workspaceId);
    const keyAvailable = await this.deps.hasLlmKey(choice.provider);
    this.viewState.set(workspaceId, { choice, keyAvailable, at: Date.now() });
    return { choice, keyAvailable };
  }

  // -------------------------------------------------------------------------
  // POST
  // -------------------------------------------------------------------------

  /**
   * Start one generation (R-15, R-39, R-74). After the workspace-scoped PR
   * read, the lock is checked and set in ONE synchronous segment (INV-7);
   * every later pre-check failure releases it. Resolves once the job is
   * enqueued — the route answers 202 before the model call.
   */
  async startGeneration(workspaceId: string, prId: string): Promise<void> {
    const pull = await this.requirePull(workspaceId, prId);
    const id = pull.id;
    if (this.running.has(id)) throw new AppError(BRIEF_RUNNING, RUNNING_MESSAGE, 409);
    this.seq += 1;
    const generationId = this.seq;
    this.running.set(id, { generationId });

    try {
      const choice = await this.deps.featureModel(workspaceId);
      const noKey = () =>
        new AppError(BRIEF_NO_KEY, noKeyMessage(choice.provider), 409, { provider: choice.provider });
      if (!(await this.deps.hasLlmKey(choice.provider))) throw noKey();
      let llm: LLMProvider;
      try {
        llm = await this.deps.llm(choice.provider);
      } catch (err) {
        if (err instanceof ConfigError) throw noKey();
        throw err;
      }
      this.started.set(id, { generationId, workspaceId, choice, llm });
      // Accepted: only now is the last failure forgotten (R-75).
      this.failures.delete(id);
      const payload: BriefJobPayload = { prId: id, generationId };
      const job = await this.deps.jobs.enqueue(workspaceId, BRIEF_JOB_KIND, payload);
      // The handler never rejects, so this fires only when the runner gave up
      // on its own wall (the handler, having claimed the generation, still
      // settles everything itself) or failed before calling the handler at
      // all. Only in the second case is the generation still unclaimed, and
      // nobody else would ever release its lock (D-7, D-39).
      job.done.catch(() => {
        const s = this.started.get(id);
        if (!s || s.generationId !== generationId) return;
        this.started.delete(id);
        this.failures.set(id, { code: 'provider_error', message: JOB_NOT_STARTED_MESSAGE, at: this.now().toISOString() });
        this.logFinished({
          prId: id,
          generationId,
          choice,
          startedAt: Date.now(),
          failureCode: 'provider_error',
          modelCalls: 0,
          result: null,
          fitted: null,
          grounded: null,
          specSkips: [],
        });
        this.release(id, generationId);
      });
    } catch (err) {
      if (this.started.get(id)?.generationId === generationId) this.started.delete(id);
      this.release(id, generationId);
      throw err;
    }
  }

  /** Releases the PR's lock only if `generationId` owns it (D-7). */
  private release(prId: string, generationId: number): void {
    if (this.running.get(prId)?.generationId === generationId) this.running.delete(prId);
  }

  /**
   * The job handler. NEVER rejects (R-17). It claims its generation before
   * its first `await` (D-39): a `JobRunner` re-invocation of the same payload
   * finds nothing in `started` and returns at once — no second model call,
   * no failure written over the outcome, no release of a newer lock.
   */
  private async handleJob(payload: BriefJobPayload): Promise<void> {
    const prId = payload?.prId;
    const s = prId ? this.started.get(prId) : undefined;
    if (!prId || !s || s.generationId !== payload.generationId) return;
    this.started.delete(prId);
    try {
      await this.run(prId, s);
    } finally {
      this.release(prId, s.generationId);
    }
  }

  /**
   * One generation: fresh PR read → facts → budget → prompt log → ONE model
   * call → validation → grounding → store → finished log. Any error is the
   * PR's failure; nothing is stored and a previous brief stays (R-38, R-60).
   */
  private async run(prId: string, s: StartedGeneration): Promise<void> {
    const { choice, llm, generationId, workspaceId } = s;
    const limits = callLimits(choice.model);
    const startedAt = Date.now();
    let modelCalls = 0;
    let result: StructuredResult<BriefModelAnswer> | null = null;
    let fitted: FittedPrompt | null = null;
    let grounded: GroundedAnswer | null = null;
    let specSkips: Array<{ path: string; reason: string }> = [];
    /** The timeout the call actually got (F-12); the limit until then. */
    let callTimeoutMs = limits.timeoutMs;
    try {
      // Read now, not at POST: the job may have waited in the shared queue
      // and the stored head SHA must be the one the facts describe.
      const pull = await this.requirePull(workspaceId, prId);
      const facts = await this.collect(workspaceId, pull);
      specSkips = facts.specSkips;
      const system = await renderPrompt(BRIEF_PROMPT_FILE, {});
      fitted = fitBudget(facts, system.length);
      logPromptAssembly(
        this.deps.logger,
        { correlationId: correlationId(prId, generationId), kind: 'brief', provider: choice.provider, model: choice.model, prId },
        [sectionMeta('system', BRIEF_PROMPT_FILE, 'trusted', system), ...toSectionMeta(fitted.sections)],
        this.deps.promptLogVerbose,
      );

      // F-12: the call may only use what is left of JobRunner's wall after
      // collection, minus a margin for storing — so the handler settles
      // before the runner gives up on it. Nothing left → a timeout, no call.
      const deadline = callDeadlineMs({
        limitMs: limits.timeoutMs,
        wallMs: JOB_WALL_MS,
        marginMs: JOB_WALL_MARGIN_MS,
        elapsedMs: Date.now() - startedAt,
      });
      if (deadline <= 0) throw new ModelCallError(new TimeoutError(0));
      callTimeoutMs = deadline;
      const outerMs = Math.min(this.deps.generationTimeoutMs ?? deadline, deadline);

      // The one model call of a generation (R-12, INV-2). The outer wall is
      // needed because OpenRouter ignores `timeoutMs` (D-38). Its errors are
      // tagged: only they may show the provider's own message (F-04).
      modelCalls = 1;
      try {
        result = await withTimeout(
          llm.completeStructured({
            model: choice.model,
            schema: BriefModelAnswer,
            schemaName: BRIEF_SCHEMA_NAME,
            temperature: GENERATION_TEMPERATURE,
            maxTokens: limits.maxTokens,
            timeoutMs: deadline,
            maxRetries: GENERATION_MAX_RETRIES,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: fitted.user },
            ],
          }),
          outerMs,
        );
      } catch (err) {
        throw new ModelCallError(err);
      }

      const checked = validateAnswer(result.data);
      if (!checked.ok) throw new InvalidOutputError();
      grounded = groundAnswer(checked.answer, groundingContext(facts.rows, facts.blast));

      try {
        const brief = toStoredBrief({
          grounded,
          facts,
          choice,
          result,
          trim: fitted.trim,
          missing: facts.missing,
          headSha: pull.headSha,
          now: this.now(),
        });
        await this.store.upsert(prId, brief);
      } catch (err) {
        throw new StoreFailedError(err);
      }
      this.logFinished({
        prId,
        generationId,
        choice,
        startedAt,
        failureCode: null,
        modelCalls,
        result,
        fitted,
        grounded,
        specSkips,
        limits: { ...limits, timeoutMs: callTimeoutMs },
      });
    } catch (err) {
      const failure = classifyGenerationError(err);
      this.failures.set(prId, { ...failure, at: this.now().toISOString() });
      this.logFinished({
        prId,
        generationId,
        choice,
        startedAt,
        failureCode: failure.code,
        modelCalls,
        result,
        fitted,
        grounded,
        specSkips,
        limits: { ...limits, timeoutMs: callTimeoutMs },
        // The real cause — server log only, never stored or served (F-04).
        error: failureLogFields(err),
      });
    }
  }

  /**
   * The `brief.generation.finished` line (R-14, D-20) — one per generation,
   * success or failure. Sizes, counts and codes only; never input text.
   */
  private logFinished(f: {
    prId: string;
    generationId: number;
    choice: FeatureModelChoice;
    startedAt: number;
    failureCode: string | null;
    modelCalls: number;
    result: StructuredResult<BriefModelAnswer> | null;
    fitted: FittedPrompt | null;
    grounded: GroundedAnswer | null;
    specSkips: Array<{ path: string; reason: string }>;
    limits?: { maxTokens: number; timeoutMs: number; reasoning: boolean };
    error?: { error: string; error_name: string | null };
  }): void {
    const limits = f.limits ?? callLimits(f.choice.model);
    const outcome = f.failureCode === null ? 'success' : 'failure';
    const cost = f.result?.costUsd ?? null;
    const durationMs = Date.now() - f.startedAt;
    const record = {
      event: 'brief.generation.finished',
      correlation_id: correlationId(f.prId, f.generationId),
      pr_id: f.prId,
      outcome,
      failure_code: f.failureCode,
      provider: f.choice.provider,
      model: f.choice.model,
      model_calls: f.modelCalls,
      attempts: f.result?.attempts ?? null,
      tokens_in: f.result?.tokensIn ?? null,
      tokens_out: f.result?.tokensOut ?? null,
      cost_usd: cost === null ? 'unknown' : cost,
      duration_ms: durationMs,
      max_tokens: limits.maxTokens,
      timeout_ms: limits.timeoutMs,
      reasoning: limits.reasoning,
      trim: f.fitted ? { ...f.fitted.trim, focus_lines_moved: f.grounded?.focusLinesMoved ?? 0 } : null,
      dropped: f.grounded?.dropped ?? null,
      spec_skips: f.specSkips,
      ...(f.error ?? {}),
    };
    const msg =
      `brief: ${outcome} ${f.choice.provider}/${f.choice.model} pr=${f.prId} calls=${f.modelCalls} ` +
      `in=${record.tokens_in ?? '-'} out=${record.tokens_out ?? '-'} ` +
      `cost=${cost === null ? 'unknown' : `$${cost.toFixed(4)}`} ${durationMs}ms`;
    if (outcome === 'success') this.deps.logger.info(record, msg);
    else this.deps.logger.warn(record, msg);
  }

  // -------------------------------------------------------------------------
  // Facts (R-09, R-10, R-27, R-64, R-65)
  // -------------------------------------------------------------------------

  /**
   * Everything the model is told, read from what is already stored or
   * computed: stored intent, the blast radius from the existing index, PR
   * files, description, the linked issue and the attached specs. Nothing is
   * derived, indexed or synced (R-10). The issue and the specs never throw:
   * a failure there is a missing input.
   */
  private async collect(workspaceId: string, pull: BriefPull): Promise<BriefFacts> {
    const [storedIntent, files, repo] = await Promise.all([
      this.deps.pulls.getIntent(pull.id),
      this.deps.pulls.getPrFiles(pull.id),
      this.deps.pulls.getRepo(pull.repoId),
    ]);
    const intent = storedIntent?.record ?? null;
    // The patch is passed through to `changedLineRanges` only (INV-9).
    const rows = toDiffRows(files, this.deps.fileRole);
    const description = normalizeDescription(pull.body);

    // The PR is already resolved (workspace-scoped) and its files read, so the
    // blast read gets both instead of reading them again (F-09).
    const [blastRead, issueRead, specsRead] = await Promise.all([
      this.deps.blast
        .forResolvedPull({ id: pull.id, repoId: pull.repoId }, files.map((f) => f.path))
        .catch(() => 'error' as const),
      this.readIssue(repo, pull.body ?? ''),
      this.readSpecs(workspaceId, repo),
    ]);
    const blast = blastRead === 'error' ? null : blastRead;

    return {
      title: pull.title,
      intent,
      blast,
      rows,
      callers: flattenCallers(blast),
      description,
      issue: issueRead.issue,
      specs: specsRead.specs,
      missing: orderMissing([
        intentMissing(intent),
        blastMissing(blastRead),
        diffMissing(rows),
        descriptionMissing(description),
        issueRead.missing,
        specsRead.missing,
      ]),
      specsBudgetSkipped: specsRead.budgetSkipped,
      specSkips: specsRead.skips,
    };
  }

  /**
   * The first same-repo issue the body closes (R-64, D-14). One `getIssue`
   * call at most; no URL from the author is ever fetched.
   */
  private async readIssue(repo: BriefRepo | undefined, body: string): Promise<IssueRead> {
    const [n] = parseClosingIssues(body);
    if (n === undefined) return { issue: null, missing: missingInput('issue', 'none_linked') };
    if (!repo) return { issue: null, missing: missingInput('issue', 'fetch_failed') };
    try {
      const gh = await this.deps.github();
      const issue = await gh.getIssue({ owner: repo.owner, name: repo.name }, n);
      return { issue: { number: n, title: issue.title, body: cutIssueBody(issue.body) }, missing: null };
    } catch (err) {
      const reason = err instanceof ConfigError ? 'github_unavailable' : 'fetch_failed';
      return { issue: null, missing: missingInput('issue', reason) };
    }
  }

  /**
   * The union of the documents attached to every enabled agent and its
   * skills, path asc, resolved through project-context (R-65, D-15).
   */
  private async readSpecs(workspaceId: string, repo: BriefRepo | undefined): Promise<SpecsRead> {
    let union: string[] = [];
    try {
      const agents = await this.deps.agents.listEnabled(workspaceId);
      // Two small reads per enabled agent, at most SPEC_READ_CONCURRENCY agents
      // at a time so a large workspace cannot drain the DB pool (F-08).
      const perAgent = await mapBounded(agents, SPEC_READ_CONCURRENCY, (a) =>
        Promise.all([
          this.deps.agents.enabledContextDocPaths(a.id),
          this.deps.skills.promptContextDocsForAgent(a.id),
        ]),
      );
      union = unionSpecPaths(
        perAgent.map(([own]) => own),
        perAgent.map(([, skills]) => skills),
      );
      if (union.length === 0) return { specs: [], missing: specsMissing(union, { docs: [], skipped: [] }), budgetSkipped: [], skips: [] };
      const target: BriefRepo = repo ?? { owner: '', name: '', clonePath: null };
      const resolved = await this.deps.projectContext.resolveForPrompt(target, { agent: union, skills: [] });
      const budgetSkipped = resolved.skipped.filter((sk) => sk.reason === 'budget').map((sk) => sk.path);
      return {
        specs: resolved.docs.map((d) => ({ path: d.path, text: d.text })),
        missing: specsMissing(union, resolved),
        budgetSkipped,
        skips: resolved.skipped.map((sk) => ({ path: sk.path, reason: sk.reason })),
      };
    } catch {
      const skipped = union.map((path) => ({ path, reason: 'read_error' }));
      return {
        specs: [],
        missing: union.length === 0 ? missingInput('specs', 'read_error') : specsMissing(union, { docs: [], skipped }),
        budgetSkipped: [],
        skips: skipped,
      };
    }
  }
}

/** Ties the prompt line and the finished line of one generation (D-20). */
function correlationId(prId: string, generationId: number): string {
  return `brief:${prId}:${generationId}`;
}
