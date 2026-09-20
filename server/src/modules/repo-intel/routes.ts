/**
 * repo-intel HTTP module.
 *
 *   GET  /repos/:id/index-state  → IndexState (always works; degraded on missing data)
 *   POST /repos/:id/resync       → enqueues a RESYNC_JOB_KIND job (202 + job id):
 *                                  fetch latest from origin + incremental reindex.
 *
 * Job-handler registration lives here: this plugin runs once at app boot and
 * calls `RepoIntelService.registerIndexJobHandlers()` so INDEX/REFRESH jobs
 * enqueued by `repos/service.ts` (after clone / on refresh) have a handler
 * to run against. Mirrors the `RepoService.registerCloneJobHandler()` shape.
 */
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getContext, requireRepoInWorkspace } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { RepoIntelService } from './service.js';
import { RESYNC_JOB_KIND } from './constants.js';
import type { IndexState } from './types.js';

export default async function repoIntelRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  // Register the INDEX/REFRESH handlers exactly once at module load. Using a
  // local service here (instead of `container.repoIntel`) is fine — the
  // JobRunner stores the handler closure, not the service instance, and the
  // lazy `container.repoIntel` getter constructs its own service for read
  // calls. Both share the same DB, so behaviour is identical.
  const service = new RepoIntelService(container);
  service.registerIndexJobHandlers();

  app.get(
    '/repos/:id/index-state',
    { schema: { params: IdParams } },
    async (req): Promise<IndexState> => {
      // The facade is tenant-agnostic — its tables carry no workspace_id — so
      // the ownership check has to happen here, before the id reaches it.
      // Resolving the context alone is not enough: the id still comes from the
      // caller.
      const { workspaceId } = await getContext(container, req);
      const repoId = await requireRepoInWorkspace(container, workspaceId, req.params.id);
      return container.repoIntel.getIndexState(repoId);
    },
  );

  app.post(
    '/repos/:id/resync',
    { schema: { params: IdParams } },
    async (req, reply) => {
      const { workspaceId } = await getContext(container, req);
      // Same ownership check as /index-state: without it a caller could queue a
      // resync of someone else's repo under their own workspace's job.
      const repoId = await requireRepoInWorkspace(container, workspaceId, req.params.id);
      // 202 even when enqueue fails (no handler / DB hiccup) so the UI can
      // still poll /index-state without an inline error path. The actual
      // outcome shows up in `repo_index_state` once the worker runs.
      let jobId: string | null = null;
      try {
        const job = await container.jobs.enqueue(workspaceId, RESYNC_JOB_KIND, {
          repoId,
        });
        jobId = job.id;
      } catch {
        // swallow — degraded path
      }
      reply.code(202);
      return jobId
        ? { status: 'accepted', jobId }
        : { status: 'accepted', degraded: true, reason: 'no_handler' };
    },
  );
}
