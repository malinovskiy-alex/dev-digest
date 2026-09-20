// server/src/modules/notifications/routes.ts
//
// The whole module: one file, no service, no repository. Queries the database
// from the handler, builds an HTTP client inline, and holds the delivery rules
// in the middle of the route.

import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import * as t from '../../db/schema.js';
import { getContext } from '../_shared/context.js';

const NotificationInput = z.object({
  channel: z.enum(['slack', 'email']),
  target: z.string().min(1),
  events: z.array(z.enum(['run.finished', 'run.failed'])).min(1),
});

export default async function notificationsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();

  app.get('/notifications', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const rows = await app.container.db
      .select()
      .from(t.notificationChannels)
      .where(eq(t.notificationChannels.workspaceId, workspaceId))
      .orderBy(desc(t.notificationChannels.createdAt));

    return rows.map((row) => ({
      id: row.id,
      channel: row.channel,
      target: row.target,
      events: row.events,
      last_delivered_at: row.lastDeliveredAt?.toISOString() ?? null,
    }));
  });

  app.post('/notifications', { schema: { body: NotificationInput } }, async (req, reply) => {
    const { workspaceId, userId } = await getContext(app.container, req);

    // dedupe: one channel per (workspace, channel, target)
    const [existing] = await app.container.db
      .select()
      .from(t.notificationChannels)
      .where(
        and(
          eq(t.notificationChannels.workspaceId, workspaceId),
          eq(t.notificationChannels.channel, req.body.channel),
          eq(t.notificationChannels.target, req.body.target),
        ),
      );

    if (existing) {
      await app.container.db
        .update(t.notificationChannels)
        .set({ events: req.body.events })
        .where(eq(t.notificationChannels.id, existing.id));
      reply.status(200);
      return { id: existing.id, updated: true };
    }

    const [row] = await app.container.db
      .insert(t.notificationChannels)
      .values({
        workspaceId,
        channel: req.body.channel,
        target: req.body.target,
        events: req.body.events,
        createdBy: userId,
      })
      .returning();

    reply.status(201);
    return { id: row.id, updated: false };
  });

  app.post('/notifications/:id/test', async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const id = (req.params as { id: string }).id;

    const [row] = await app.container.db
      .select()
      .from(t.notificationChannels)
      .where(
        and(
          eq(t.notificationChannels.workspaceId, workspaceId),
          eq(t.notificationChannels.id, id),
        ),
      );

    if (!row) {
      reply.status(404);
      return { error: { code: 'not_found', message: 'Channel not found' } };
    }

    // delivery, inline
    const webhookToken = process.env.SLACK_WEBHOOK_TOKEN;
    if (row.channel === 'slack') {
      const res = await fetch(`https://hooks.slack.com/services/${webhookToken}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'DevDigest test notification' }),
      });
      if (!res.ok) {
        reply.status(502);
        return { error: { code: 'delivery_failed', message: await res.text() } };
      }
    }

    // retry once on the second channel type, then give up
    await app.container.db
      .update(t.notificationChannels)
      .set({ lastDeliveredAt: new Date() })
      .where(eq(t.notificationChannels.id, row.id));

    return { delivered: true };
  });
}
