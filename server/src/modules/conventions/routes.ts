import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ConventionCategory, ConventionStatus, SkillType } from '@devdigest/shared';
import { getContext, requireRepoInWorkspace } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { ConventionsService } from './service.js';

/**
 * A7 — conventions module.
 *   GET    /repos/:id/conventions              → the screen (scan + candidates)
 *   POST   /repos/:id/conventions/extract      → scan; replaces the last scan
 *   PATCH  /conventions/:id                    → accept / reject / correct
 *   GET    /repos/:id/conventions/skill-draft  → the skill the accepted ones make
 *   POST   /repos/:id/conventions/skill        → store it (source: 'extracted')
 *
 * Every repo-scoped route confirms the repo belongs to the caller's workspace
 * before the id reaches anything else: `conventions` carries `workspace_id`, but
 * `repoIntel` and the git adapter do not, and this route hands them a
 * caller-supplied id. A row in another workspace is a 404, never a 403.
 */

/** Both shapes of `PATCH` in one body: the accept/reject click and the edit. */
const UpdateConventionBody = z
  .object({
    status: ConventionStatus.optional(),
    rule: z.string().min(1).optional(),
    category: ConventionCategory.optional(),
  })
  .refine((b) => b.status !== undefined || b.rule !== undefined || b.category !== undefined, {
    message: 'Nothing to update',
  });

/**
 * `convention_ids` names the candidates the draft was built from — it decides
 * the skill's `evidence_files`, nothing else. The body is whatever the modal
 * submits: the draft is a starting point, and an edited body is the point of
 * showing it.
 *
 * `source` is deliberately absent, as it is on `POST /skills`: provenance is
 * decided by the endpoint the write came through, never by the payload.
 */
const CreateSkillBody = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  type: SkillType,
  body: z.string().min(1),
  enabled: z.boolean(),
  convention_ids: z.array(z.string().uuid()),
});

export default async function conventionsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new ConventionsService(app.container);

  app.get('/repos/:id/conventions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const repoId = await requireRepoInWorkspace(app.container, workspaceId, req.params.id);
    return service.view(workspaceId, repoId);
  });

  /**
   * Runs the model inline — a scan takes tens of seconds and the screen waits
   * on it. That is inside Node's 300 s request timeout (nothing here overrides
   * it) and well inside the extractor's own 120 s cap, so the client sees the
   * finished scan rather than a job id it would have to poll.
   */
  app.post(
    '/repos/:id/conventions/extract',
    { schema: { params: IdParams } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const repoId = await requireRepoInWorkspace(app.container, workspaceId, req.params.id);
      return service.extract(workspaceId, repoId);
    },
  );

  app.patch(
    '/conventions/:id',
    { schema: { params: IdParams, body: UpdateConventionBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const updated = await service.update(workspaceId, req.params.id, {
        ...(req.body.status !== undefined ? { status: req.body.status } : {}),
        ...(req.body.rule !== undefined ? { rule: req.body.rule } : {}),
        ...(req.body.category !== undefined ? { category: req.body.category } : {}),
      });
      if (!updated) throw new NotFoundError('Convention not found');
      return updated;
    },
  );

  app.get('/repos/:id/conventions/skill-draft', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const repoId = await requireRepoInWorkspace(app.container, workspaceId, req.params.id);
    return service.skillDraft(workspaceId, repoId);
  });

  app.post(
    '/repos/:id/conventions/skill',
    { schema: { params: IdParams, body: CreateSkillBody } },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      const repoId = await requireRepoInWorkspace(app.container, workspaceId, req.params.id);
      const skill = await service.createSkill(workspaceId, repoId, {
        name: req.body.name,
        description: req.body.description,
        type: req.body.type,
        body: req.body.body,
        enabled: req.body.enabled,
        conventionIds: req.body.convention_ids,
      });
      reply.status(201);
      return skill;
    },
  );
}
