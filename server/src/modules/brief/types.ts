/**
 * PR Brief (L05) — the narrow ports this module needs, declared here (D-11).
 *
 * `no-cross-module` (with `tsPreCompilationDeps: true`) forbids even
 * `import type` from a sibling module's folder, and even `import type
 * { Container }` closes a cycle (`server/INSIGHTS.md:125-129`). So each port
 * mirrors only the members the brief reads; the container's shared
 * repositories and services satisfy them structurally — typecheck enforces
 * that in `routes.ts`, where they are wired in. `BriefServiceDeps` itself
 * lives in `service.ts`: it carries the Ring-3 `Db`, which a Ring-1 file
 * must not name (F-01).
 *
 * INV-4 / R-10 hold by construction: these deps expose reads only. There is
 * no intent derive, no index rebuild, no GitHub PR sync member anywhere here.
 */
import type {
  BlastRadius,
  BriefMissingInput,
  Intent,
  RepoRef,
  SmartDiffRole,
} from '@devdigest/shared';

// ---------------------------------------------------------------------------
// Rows, as far as the brief reads them (declared locally, never from db/rows)
// ---------------------------------------------------------------------------

/** A pull request row, as far as the brief reads it. */
export interface BriefPull {
  id: string;
  repoId: string;
  number: number;
  title: string;
  headSha: string;
  body: string | null;
}

/** A repo row, as far as the brief reads it. */
export interface BriefRepo {
  owner: string;
  name: string;
  clonePath: string | null;
}

/** One `pr_files` row. `patch` is read only by `changedLineRanges` (INV-9). */
export interface BriefPrFile {
  path: string;
  additions: number;
  deletions: number;
  patch: string | null;
}

// ---------------------------------------------------------------------------
// Ports
// ---------------------------------------------------------------------------

/** `container.reviewRepo`, read-only members only. */
export interface BriefPullSource {
  /** Workspace-scoped; undefined when the PR is not in the workspace (R-18). */
  getPull(workspaceId: string, prId: string): Promise<BriefPull | undefined>;
  getRepo(repoId: string): Promise<BriefRepo | undefined>;
  getPrFiles(prId: string): Promise<BriefPrFile[]>;
  /** The stored intent; never derives one (R-10). */
  getIntent(prId: string): Promise<{ record: Intent } | undefined>;
}

/**
 * `container.blast` — the PR's blast radius read from the existing index, for
 * a PR the brief already resolved (workspace-scoped) and whose changed paths
 * it already read, so neither is read twice per generation (F-09).
 */
export interface BriefBlastSource {
  forResolvedPull(pull: { id: string; repoId: string }, paths: string[]): Promise<BlastRadius>;
}

/** `container.agentsRepo`, as far as the specs input reads it (D-15). */
export interface BriefAgentDocs {
  listEnabled(workspaceId: string): Promise<Array<{ id: string }>>;
  enabledContextDocPaths(agentId: string): Promise<string[]>;
}

/** `container.skillsRepo`, as far as the specs input reads it (D-15). */
export interface BriefSkillDocs {
  promptContextDocsForAgent(agentId: string): Promise<Array<{ skillName: string; paths: string[] }>>;
}

/** `container.projectContext` — resolves attached documents for a prompt (D-15). */
export interface BriefContextSource {
  resolveForPrompt(
    repo: BriefRepo,
    refs: { agent: string[]; skills: Array<{ skillName: string; paths: string[] }> },
  ): Promise<{
    docs: Array<{ path: string; text: string; chars: number; truncated: boolean }>;
    skipped: Array<{ path: string; reason: string }>;
  }>;
}

/** The GitHub port, reduced to the one read the brief makes (R-10, R-64). */
export interface BriefIssueSource {
  getIssue(repo: RepoRef, n: number): Promise<{ number: number; title: string; body?: string | null }>;
}

/** The background job queue (structurally `JobRunner`, D-6). */
export interface BriefJobQueue {
  register(kind: string, handler: (payload: unknown) => Promise<void>): void;
  enqueue(workspaceId: string, kind: string, payload: unknown): Promise<{ id: string; done: Promise<void> }>;
}

/** The slice of the pino logger the brief uses (and `PromptLogSink`). */
export interface BriefLogger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
}

// ---------------------------------------------------------------------------
// Collected facts and grounding
// ---------------------------------------------------------------------------

/** One changed file as the model sees it (D-12, D-23). */
export interface DiffRow {
  path: string;
  role: SmartDiffRole;
  additions: number;
  deletions: number;
  /** Maximal runs of added new-side lines (D-13). */
  ranges: Array<[number, number]>;
}

/** One blast-radius caller, flattened in blast order (D-12). */
export interface BriefCaller {
  name: string;
  file: string;
  line: number;
}

/** One resolved spec document (D-15). */
export interface BriefSpec {
  path: string;
  text: string;
}

/** The linked issue (R-64); `body` already cut to `ISSUE_BODY_MAX_CHARS`. */
export interface BriefIssue {
  number: number;
  title: string;
  body: string;
}

/** Everything collected for one generation, before the budget (D-12). */
export interface BriefFacts {
  /** PR title — always sent, never trimmed (D-37). */
  title: string;
  intent: Intent | null;
  /** The full blast map; null when the read threw. Grounding uses all of it. */
  blast: BlastRadius | null;
  /** Rows sorted by path asc. */
  rows: DiffRow[];
  /** Callers in blast order. */
  callers: BriefCaller[];
  /** '' when missing. */
  description: string;
  issue: BriefIssue | null;
  /** Path asc. */
  specs: BriefSpec[];
  /** In the fixed D-16 order. */
  missing: BriefMissingInput[];
  /** Specs project-context skipped for its own section budget (D-15, → `trim.specs_removed`). */
  specsBudgetSkipped: string[];
  /** Per-document spec skips, for the completion log only. */
  specSkips: Array<{ path: string; reason: string }>;
}

/** What grounding checks the model's paths and lines against (D-13, D-18). */
export interface GroundingContext {
  /** PR changed paths, before any row trim. */
  prPaths: Set<string>;
  /** Added-line ranges per PR path. */
  ranges: Map<string, Array<[number, number]>>;
  /** Caller lines per file of the FULL blast map, ascending. */
  callerLines: Map<string, number[]>;
  /** Changed-symbol files and caller files of the full blast map. */
  blastPaths: Set<string>;
}

/** Payload of one brief generation job (D-6). */
export interface BriefJobPayload {
  prId: string;
  /** Which `startGeneration` call this job belongs to (D-7). */
  generationId: number;
}
