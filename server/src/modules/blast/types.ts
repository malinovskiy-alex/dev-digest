import type { BlastDegradedReason, BlastIndexStatus } from '@devdigest/shared';

/**
 * blast module — the narrow ports this module needs, declared here (D2).
 *
 * `no-cross-module` (with `tsPreCompilationDeps: true`) forbids even
 * `import type` from `../repo-intel/` or `../reviews/`, so these mirror only
 * the members the blast service reads. `container.repoIntel` and
 * `container.reviewRepo` satisfy them structurally — typecheck enforces that
 * at the route where they are wired in.
 */

/** One caller row as the repo-intel facade returns it. */
export interface BlastFacadeCaller {
  file: string;
  /** Enclosing symbol of the reference (the caller's name). */
  symbol: string;
  /** Which changed symbol this caller reaches. */
  viaSymbol: string;
  /** 1-based line of the reference. */
  line: number;
  /** file_rank.rank of the caller file (0 on the ripgrep fallback). */
  rank: number;
}

/** `RepoIntel.getBlastRadius` result, as far as blast reads it. */
export interface BlastFacadeResult {
  changedSymbols: { file: string; name: string; kind: string }[];
  callers: BlastFacadeCaller[];
  impactedEndpoints: string[];
  /** Per caller file; present on the persistent-index path only. */
  factsByFile?: Record<string, { endpoints: string[]; crons: string[] }>;
  degraded?: boolean;
  reason?: BlastDegradedReason;
}

/** `RepoIntel.getIndexState`, as far as blast reads it. */
export interface BlastIndexView {
  status: BlastIndexStatus;
  /** '' when the repo was never indexed. */
  lastIndexedSha: string;
}

export interface BlastRepoIntel {
  getBlastRadius(repoId: string, changedFiles: string[]): Promise<BlastFacadeResult>;
  getIndexState(repoId: string): Promise<BlastIndexView>;
}

export interface BlastPullSource {
  /** Workspace-scoped PR lookup; undefined when the PR is not in the workspace. */
  getPull(workspaceId: string, prId: string): Promise<{ id: string; repoId: string } | undefined>;
  getPrFiles(prId: string): Promise<{ path: string }[]>;
}

/** The slice of the Fastify/pino logger the service uses. Module-local on purpose. */
export interface BlastLogger {
  info(obj: Record<string, unknown>, msg: string): void;
}

export interface BlastServiceDeps {
  pulls: BlastPullSource;
  repoIntel: BlastRepoIntel;
}
