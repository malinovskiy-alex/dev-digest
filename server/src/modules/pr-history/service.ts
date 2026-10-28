import type { PrHistory, RepoRef } from '@devdigest/shared';
import { NotFoundError } from '../../platform/errors.js';
import {
  PRIOR_PR_CANDIDATES,
  PRIOR_PR_FETCH_BUDGET,
  PRIOR_PR_FETCH_CONCURRENCY,
} from './constants.js';
import { toPrHistory } from './helpers.js';
import type { HistoryGitHub, HistoryLogger, MergedPull, PrHistoryServiceDeps } from './types.js';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * pr-history — "Prior PRs touching these files" (D14).
 *
 * Candidates are DB-only: merged PRs DevDigest already synced for this repo in
 * this workspace. A candidate's files come from `pr_files` when present;
 * otherwise ONE GitHub `listPullFiles` call fetches them and writes them back to
 * `pr_files` (a merged PR's files never change, so the cache has no TTL). At
 * most PRIOR_PR_FETCH_BUDGET calls per request; the rest are reported as
 * `unchecked` and filled on later loads.
 *
 * GitHub failures never fail the request (D14a): cached matches are still
 * returned and `github_unavailable` is set.
 */
export class PrHistoryService {
  constructor(private deps: PrHistoryServiceDeps) {}

  async forPull(workspaceId: string, prId: string, log?: HistoryLogger): Promise<PrHistory> {
    const startedAt = Date.now();
    const { pulls } = this.deps;

    const pull = await pulls.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');
    const currentPaths = (await pulls.getPrFiles(pull.id)).map((f) => f.path);

    // Scoped by workspace AND repo; the current PR is excluded in SQL.
    const candidates = (
      await pulls.listMergedPulls(workspaceId, pull.repoId, pull.id, PRIOR_PR_CANDIDATES)
    ).filter((c) => c.id !== pull.id);
    const cached = await pulls.getPrFilePaths(candidates.map((c) => c.id));
    const cachedCount = cached.size;

    const missing = candidates.filter((c) => !cached.has(c.id));
    const toFetch = missing.slice(0, PRIOR_PR_FETCH_BUDGET);

    let githubUnavailable = false;
    let fetchedOk = 0;
    if (toFetch.length > 0) {
      let gh: HistoryGitHub | null = null;
      let ref: RepoRef | null = null;
      try {
        const repo = await pulls.getRepo(pull.repoId);
        if (!repo) throw new Error('repo not found');
        ref = { owner: repo.owner, name: repo.name };
        gh = await this.deps.github();
      } catch (err) {
        githubUnavailable = true;
        log?.warn({ prId, err: errorMessage(err) }, 'prior PRs: GitHub unavailable');
      }

      if (gh && ref) {
        const client = gh;
        const repoRef = ref;
        for (let i = 0; i < toFetch.length; i += PRIOR_PR_FETCH_CONCURRENCY) {
          const chunk = toFetch.slice(i, i + PRIOR_PR_FETCH_CONCURRENCY);
          const results = await Promise.allSettled(
            chunk.map(async (c: MergedPull) => {
              const files = await client.listPullFiles(repoRef, c.number);
              await pulls.replacePrFiles(c.id, files);
              return { id: c.id, paths: files.map((f) => f.path) };
            }),
          );
          results.forEach((r, j) => {
            if (r.status === 'fulfilled') {
              cached.set(r.value.id, r.value.paths);
              fetchedOk += 1;
            } else {
              githubUnavailable = true;
              log?.warn(
                { prId, prNumber: chunk[j]?.number, err: errorMessage(r.reason) },
                'prior PRs: listPullFiles failed',
              );
            }
          });
        }
      }
    }

    const checked = candidates
      .filter((c) => cached.has(c.id))
      .map((c) => ({ pull: c, paths: cached.get(c.id) ?? [] }));
    const unchecked = missing.length - fetchedOk;

    log?.info(
      {
        prId,
        candidates: candidates.length,
        cached: cachedCount,
        fetched: fetchedOk,
        unchecked,
        githubUnavailable,
        ms: Date.now() - startedAt,
      },
      'prior PRs from synced merged PRs',
    );

    return toPrHistory(currentPaths, checked, {
      candidates: candidates.length,
      unchecked,
      githubUnavailable,
    });
  }
}
