import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { BriefGenerateAccepted, PrBriefView } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { GENERATE_RATE_LIMIT_MAX, GENERATE_RATE_LIMIT_WINDOW } from './constants.js';
import { BriefService } from './service.js';

/**
 * L05 — PR Brief.
 *   GET  /pulls/:id/brief           → the stored brief + read-time state
 *                                     (stale, generating, last failure, key);
 *                                     never calls a model (R-03)
 *   POST /pulls/:id/brief/generate  → 202 once ONE generation is enqueued; the
 *                                     client polls GET while `generating`.
 *                                     409 while one runs (R-15) or without a
 *                                     key (R-39); 404 for a PR outside the
 *                                     caller's workspace (R-18)
 *
 * The service's first read is the workspace-scoped `getPull`, before its lock
 * (D-7), so a foreign id is a 404 on both routes, never a 409.
 *
 * The service is built ONCE per plugin instance: one lock map and one
 * registration of the job handler. Each registration stays on one line up to
 * the path string, for repo-intel's line-based endpoint extractor.
 */
export default async function briefRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const c = app.container;
  const service = new BriefService({
    db: c.db,
    pulls: c.reviewRepo,
    blast: c.blast,
    fileRole: (path) => c.smartDiffRole(path),
    agents: c.agentsRepo,
    skills: c.skillsRepo,
    projectContext: c.projectContext,
    github: () => c.github(),
    featureModel: (workspaceId) => c.featureModel(workspaceId, 'risk_brief'),
    hasLlmKey: (provider) => c.hasLlmKey(provider),
    llm: (provider) => c.llm(provider),
    jobs: c.jobs,
    // The app logger, not `req.log`: a generation outlives its request.
    logger: app.log,
    promptLogVerbose: c.config.promptLogVerbose,
  });

  app.get('/pulls/:id/brief', { schema: { params: IdParams, response: { 200: PrBriefView } } }, async (req) => {
    const { workspaceId } = await getContext(c, req);
    return service.getView(workspaceId, req.params.id);
  });

  // Each accepted POST may cost a paid model call: a per-route limit on top of
  // the app-wide one (F-06), in addition to "one generation per PR at a time".
  app.post('/pulls/:id/brief/generate', { schema: { params: IdParams, response: { 202: BriefGenerateAccepted } }, config: { rateLimit: { max: GENERATE_RATE_LIMIT_MAX, timeWindow: GENERATE_RATE_LIMIT_WINDOW } } }, async (req, reply) => {
    const { workspaceId } = await getContext(c, req);
    await service.startGeneration(workspaceId, req.params.id);
    reply.code(202);
    const accepted: BriefGenerateAccepted = { generating: true };
    return accepted;
  });
}
