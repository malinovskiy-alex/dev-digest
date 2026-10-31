import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ContextDocContent, ContextDocList } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { MAX_CONTEXT_DOC_PATH_LENGTH } from '../_shared/context-docs/helpers.js';

/**
 * project-context module (L05).
 *   GET /repos/:id/context-docs              → the clone's markdown docs at HEAD
 *   GET /repos/:id/context-docs/content?path → one doc's content at HEAD
 *
 * Read-only: there is no write route — documents are edited in the repo itself.
 * A repo outside the caller's workspace is a 404 (thrown by the service). The
 * querystring is only bounded here; the service applies the full path rule so
 * a bad path is a typed 422, and checks tree membership for the 404.
 */
const ContentQuery = z.object({ path: z.string().min(1).max(MAX_CONTEXT_DOC_PATH_LENGTH) });

export default async function projectContextRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  // Hangs off the container (not `new`ed here) because run-executor resolves
  // prompt documents through the same instance and its per-sha cache.
  const service = container.projectContext;

  app.get(
    '/repos/:id/context-docs',
    { schema: { params: IdParams, response: { 200: ContextDocList } } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return service.listDocs(workspaceId, req.params.id);
    },
  );

  app.get(
    '/repos/:id/context-docs/content',
    { schema: { params: IdParams, querystring: ContentQuery, response: { 200: ContextDocContent } } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return service.readDoc(workspaceId, req.params.id, req.query.path);
    },
  );
}
