import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { BlastRadius } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';

/**
 * blast module (L04).
 *   GET /pulls/:id/blast → the PR's BlastRadius, read from the repo-intel index
 *
 * A PR outside the caller's workspace is a 404 (thrown by the service). The
 * response is validated against the `BlastRadius` contract on the way out.
 * The registration stays on one line up to the path string so repo-intel's
 * line-based endpoint extractor sees it (specs/L04-blast-radius.md Q5).
 */
export default async function blastRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  // One shared instance, built in the composition root (also read by the PR brief).
  const service = container.blast;

  app.get('/pulls/:id/blast', { schema: { params: IdParams, response: { 200: BlastRadius } } }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    return service.forPull(workspaceId, req.params.id, req.log);
  });
}
