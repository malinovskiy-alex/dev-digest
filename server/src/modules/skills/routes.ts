import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { SkillsService } from './service.js';

/**
 * A1 — skills module (owner A1).
 *   GET    /skills                  → list (workspace-scoped, name asc)
 *   GET    /skills/:id              → one skill
 *   POST   /skills                  → create by hand (source forced to "manual")
 *   PUT    /skills/:id              → partial update (a changed body versions)
 *   DELETE /skills/:id              → delete, reporting the agents that lost it
 *   GET    /skills/:id/versions     → body history (newest first)
 *   POST   /skills/import/preview   → parse an upload; writes NOTHING
 *   POST   /skills/import           → persist a previewed upload (disabled, D6)
 *
 * Every route resolves its tenancy through `getContext`; a row in another
 * workspace is a 404, never a 403, so a response cannot confirm that an id
 * exists somewhere else.
 */

/**
 * `source` is deliberately absent: provenance is decided by the endpoint the
 * upload came through, not by the client. A `source` key in the payload is
 * stripped by zod and the service writes `manual` regardless.
 */
const CreateSkillBody = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  type: SkillType,
  body: z.string().min(1),
  enabled: z.boolean().optional(),
});

/** Partial update — every field optional, but none of them empty. */
const UpdateSkillBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  type: SkillType.optional(),
  body: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

/**
 * The two upload shapes. There is no `@fastify/multipart` here and none is
 * needed: the client reads the file itself and posts JSON — `text` for a bare
 * markdown file, `base64` for an archive.
 */
const MarkdownUpload = z.object({
  kind: z.literal('markdown'),
  filename: z.string().min(1),
  text: z.string().min(1),
});

const ArchiveUpload = z.object({
  kind: z.literal('archive'),
  filename: z.string().min(1),
  base64: z.string().min(1),
});

const ImportBody = z.discriminatedUnion('kind', [MarkdownUpload, ArchiveUpload]);

/**
 * What confirm adds to the upload: the `token` the preview handed out, plus
 * the three fields the user may have corrected in the preview form.
 *
 * `description` is `z.string()` and NOT `.min(1)` on purpose — a heading-only
 * markdown file legitimately previews with an empty description, and rejecting
 * it here would make a file the preview accepted impossible to import. `POST
 * /skills` still requires a non-empty one: that path has no upload to blame.
 *
 * Extending each member keeps this a real discriminated union (a `z.intersection`
 * of a union would lose the `kind`-keyed dispatch and its error messages).
 */
const ConfirmFields = {
  token: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  type: SkillType,
};

const ConfirmImportBody = z.discriminatedUnion('kind', [
  MarkdownUpload.extend(ConfirmFields),
  ArchiveUpload.extend(ConfirmFields),
]);

/**
 * Both import routes lift the body cap. `app.ts` sets a 1 MiB global limit,
 * base64 inflates by ~33%, and the parser's own cap is 2 MiB of archive — so
 * without this a perfectly good 900 KB archive would 413 at the transport
 * layer with an opaque error instead of reaching the guards that can explain
 * themselves.
 */
const IMPORT_BODY_LIMIT = 4 * 1024 * 1024;

export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new SkillsService(app.container);

  app.get('/skills', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId);
  });

  app.get('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.get(workspaceId, req.params.id);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.post('/skills', { schema: { body: CreateSkillBody } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const body = req.body;
    const skill = await service.create(workspaceId, {
      name: body.name,
      description: body.description,
      type: body.type,
      body: body.body,
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    });
    reply.status(201);
    return skill;
  });

  app.put('/skills/:id', { schema: { params: IdParams, body: UpdateSkillBody } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.update(workspaceId, req.params.id, req.body);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.delete('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const result = await service.delete(workspaceId, req.params.id);
    if (!result) throw new NotFoundError('Skill not found');
    return { ok: true, unlinked_from: result.unlinked_from };
  });

  app.get('/skills/:id/versions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const versions = await service.versions(workspaceId, req.params.id);
    if (!versions) throw new NotFoundError('Skill not found');
    return versions;
  });

  /** Parse only. Writes nothing — not even for a valid upload. */
  app.post(
    '/skills/import/preview',
    { bodyLimit: IMPORT_BODY_LIMIT, schema: { body: ImportBody } },
    async (req) => {
      await getContext(app.container, req);
      return service.previewImport(req.body);
    },
  );

  app.post(
    '/skills/import',
    { bodyLimit: IMPORT_BODY_LIMIT, schema: { body: ConfirmImportBody } },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      const skill = await service.confirmImport(workspaceId, req.body);
      reply.status(201);
      return skill;
    },
  );
}
