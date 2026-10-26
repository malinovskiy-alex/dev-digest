import type { BlastRadius } from '@devdigest/shared';
import { NotFoundError } from '../../platform/errors.js';
import { toBlastRadius } from './helpers.js';
import type { BlastLogger, BlastServiceDeps } from './types.js';

/**
 * blast — the PR's blast radius, read from what repo-intel already indexed.
 *
 * No parsing, no import-graph rebuild, no model: one `getBlastRadius` call plus
 * one `getIndexState` read per request (D3), then a pure mapping. The deps hold
 * no LLM, git or GitHub client, so P2.4 holds by construction.
 */
export class BlastService {
  constructor(private deps: BlastServiceDeps) {}

  async forPull(workspaceId: string, prId: string, log?: BlastLogger): Promise<BlastRadius> {
    const startedAt = Date.now();
    // Workspace-scoped: repo-intel tables carry no workspace_id, so the repo id
    // must come from a pull row the caller's workspace owns.
    const pull = await this.deps.pulls.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');

    const paths = (await this.deps.pulls.getPrFiles(pull.id)).map((f) => f.path);
    const [facade, index] = await Promise.all([
      this.deps.repoIntel.getBlastRadius(pull.repoId, paths),
      this.deps.repoIntel.getIndexState(pull.repoId),
    ]);

    const blast = toBlastRadius(facade, index);

    log?.info(
      {
        prId,
        repoId: pull.repoId,
        changedFiles: paths.length,
        source: facade.degraded ? 'fallback' : 'index',
        indexStatus: blast.index_status,
        reason: blast.reason,
        symbols: blast.counts.symbols,
        callers: blast.counts.callers,
        endpoints: blast.counts.endpoints,
        crons: blast.counts.crons,
        ms: Date.now() - startedAt,
      },
      'blast radius read from repo-intel index (no reparse, no LLM)',
    );

    return blast;
  }
}
