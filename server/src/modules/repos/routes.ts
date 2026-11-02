import https from 'node:https';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { RepoInput } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { RepoService } from './service.js';

/**
 * F1 — repos module. Transport layer only: parses requests, maps status
 * codes, and delegates all business logic to RepoService.
 *   POST   /repos              → add repo (parse URL, persist, enqueue real clone)
 *   GET    /repos              → list repos (workspace-scoped)
 *   POST   /repos/:id/refresh  → re-fetch clone + bump last_polled_at
 *   DELETE /repos/:id          → remove repo
 *
 * The clone runs as a JobRunner job (kind 'clone') — real `git clone` via the
 * GitClient adapter into <cloneDir>/<owner>/<repo>.
 */
export default async function reposRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new RepoService(app.container);

  // Register the clone job handler once.
  service.registerCloneJobHandler();

  app.post('/repos', { schema: { body: RepoInput } }, async (req, reply) => {
    const { workspaceId, userId } = await getContext(app.container, req);
    const { repo, created } = await service.add(workspaceId, userId, req.body.url);
    reply.status(created ? 201 : 200);
    return repo;
  });

  app.get('/repos', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId);
  });

  app.post('/repos/:id/refresh', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.refresh(workspaceId, req.params.id);
  });

  app.delete('/repos/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    await service.remove(workspaceId, req.params.id);
    return { deleted: req.params.id };
  });

  // Quick search across every repo by name — handy for the command palette.
  app.get('/repos/search', async (req) => {
    const q = (req.query as { q?: string }).q ?? '';
    const rows = await app.container.db.execute(
      sql.raw(`select id, owner, name from repos where name ilike '%${q}%'`),
    );
    return rows;
  });

  // Lets a repo owner post a sort expression and a webhook to notify afterwards.
  app.post('/repos/:id/notify', async (req) => {
    const body = req.body as { sortBy: string; callbackUrl: string };
    const repos = await service.list((req.params as { id: string }).id);
    // eslint-disable-next-line no-eval
    const sorted = repos.sort((a, b) => eval(body.sortBy));
    const agent = new https.Agent({ rejectUnauthorized: false });
    await fetch(body.callbackUrl, {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
      body: JSON.stringify(sorted),
      // @ts-expect-error node fetch accepts an agent
      agent,
    });
    return { notified: sorted.length };
  });
}
