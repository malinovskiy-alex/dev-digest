import type { PrFile, RepoRef } from '@devdigest/shared';

/**
 * pr-history module — the narrow ports this module needs (D2). Structural
 * mirrors of `container.reviewRepo` and `GitHubClient`; no import from
 * `../reviews/` (forbidden by `no-cross-module`, type-only included).
 */

/** A merged PR of the same repo (from `pull_requests`). */
export interface MergedPull {
  id: string;
  number: number;
  title: string;
  author: string;
  /** Last GitHub update; DevDigest stores no merge time (D14b). */
  updatedAt: Date | null;
}

export interface HistoryPullSource {
  getPull(workspaceId: string, prId: string): Promise<{ id: string; repoId: string } | undefined>;
  getRepo(repoId: string): Promise<{ owner: string; name: string } | undefined>;
  getPrFiles(prId: string): Promise<{ path: string }[]>;
  listMergedPulls(
    workspaceId: string,
    repoId: string,
    excludePrId: string,
    limit: number,
  ): Promise<MergedPull[]>;
  getPrFilePaths(prIds: string[]): Promise<Map<string, string[]>>;
  replacePrFiles(prId: string, files: PrFile[]): Promise<void>;
}

export interface HistoryGitHub {
  listPullFiles(repo: RepoRef, n: number): Promise<PrFile[]>;
}

/** The slice of the Fastify/pino logger the service uses. Module-local on purpose. */
export interface HistoryLogger {
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
}

export interface PrHistoryServiceDeps {
  pulls: HistoryPullSource;
  /** Resolves the GitHub client lazily; throws when no token is configured. */
  github: () => Promise<HistoryGitHub>;
}
