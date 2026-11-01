import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { TourGenerateAccepted } from '@devdigest/shared';
import { getContext, requireRepoInWorkspace } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { OnboardingService } from './service.js';

/**
 * L05 — Onboarding Tour.
 *   GET  /repos/:id/tour           → the tour (stored, or a deterministic skeleton);
 *                                    never calls a model
 *   POST /repos/:id/tour/generate  → 202 once ONE generation has started; the
 *                                    client polls GET until `generation.running`
 *                                    is false. 409 while one runs, 422 when the
 *                                    repo is not cloned / not indexed / has no key
 *
 * Both confirm the repo belongs to the caller's workspace before the index or
 * git adapters (tenant-agnostic) see the id, and a repo in another workspace is
 * a 404, never a 403 (AC-19, AC-65). GET leaves that to `getTour`, whose first
 * read is the workspace-scoped repo lookup, so the row is fetched once (F-14).
 * POST keeps the guard here: `startGeneration` takes its lock before its first
 * `await` (INV-17), so without the guard a foreign id could answer 409 instead
 * of 404 while that repo generates.
 *
 * The service is built once per app instance (D-38), so there is exactly one
 * running-registry and one registration of its job handler: a second POST for
 * the same repo sees the first.
 */
export default async function onboardingRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const c = app.container;
  const service = new OnboardingService({
    db: c.db,
    repos: c.reposRepo,
    repoIntel: c.repoIntel,
    git: c.git,
    featureModel: (workspaceId) => c.featureModel(workspaceId, 'onboarding'),
    llm: (provider) => c.llm(provider),
    hasLlmKey: (provider) => c.hasLlmKey(provider),
    jobs: c.jobs,
    // The app logger, not `req.log`: a generation outlives its request (F-37).
    log: app.log,
  });

  app.get('/repos/:id/tour', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(c, req);
    return service.getTour(workspaceId, req.params.id);
  });

  app.post('/repos/:id/tour/generate', { schema: { params: IdParams } }, async (req, reply) => {
    const { workspaceId } = await getContext(c, req);
    const repoId = await requireRepoInWorkspace(c, workspaceId, req.params.id);
    await service.startGeneration(workspaceId, repoId);
    reply.code(202);
    const accepted: TourGenerateAccepted = { running: true };
    return accepted;
  });
}
