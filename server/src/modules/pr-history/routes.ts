import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PrHistory } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { PrHistoryService } from './service.js';

/**
 * pr-history module (L04).
 *   GET /pulls/:id/history → merged PRs DevDigest has synced that touched the same files
 *
 * A read that may fill the `pr_files` cache from GitHub (bounded per request),
 * hence the per-route rate limit. GitHub failures degrade into
 * `github_unavailable`, never a 5xx. A PR outside the workspace is a 404.
 */
export default async function prHistoryRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const service = new PrHistoryService({
    pulls: container.reviewRepo,
    github: () => container.github(),
  });

  app.get('/pulls/:id/history', { schema: { params: IdParams, response: { 200: PrHistory } }, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    return service.forPull(workspaceId, req.params.id, req.log);
  });
}
