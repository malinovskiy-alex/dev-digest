import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  AgentPerformanceReport,
  AgentStatsReport,
  PerfRangeQuery,
  SkillStatsReport,
  SkillsPullFrequencyReport,
} from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { toPerfRange } from './helpers.js';
import { AgentPerformanceService } from './service.js';

/**
 * agent-performance module (L08).
 *   GET /agents/performance?from&to&tz&bucket → AgentPerformanceReport (dashboard)
 *   GET /agents/:id/stats?from&to&tz          → AgentStatsReport (one agent)
 *   GET /skills/pull-frequency?from&to&tz     → SkillsPullFrequencyReport (L08 skill-stats)
 *   GET /skills/:id/stats?from&to&tz          → SkillStatsReport (L08 skill-stats)
 *
 * The querystring is validated before the handler (missing/garbled range,
 * from >= to, unknown tz → 422 via the global handler, R-28). The static
 * `/agents/performance` wins over the agents module's `/agents/:id` in
 * find-my-way, so it is never captured as an id; likewise the static
 * `/skills/pull-frequency` over the skills module's `/skills/:id`. The skill
 * reads live here, not in the skills module, because they reuse this module's
 * counted-run predicate (skill-stats D-1). `bucket` is ignored by both. Registrations stay on one
 * line up to the path string for repo-intel's endpoint extractor.
 */
export default async function agentPerformanceRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const service = AgentPerformanceService.fromDb(container.db);

  app.get('/agents/performance', { schema: { querystring: PerfRangeQuery, response: { 200: AgentPerformanceReport } } }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    return service.dashboard(workspaceId, toPerfRange(req.query));
  });

  app.get('/agents/:id/stats', { schema: { params: IdParams, querystring: PerfRangeQuery, response: { 200: AgentStatsReport } } }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    return service.agentStats(workspaceId, req.params.id, toPerfRange(req.query));
  });

  app.get('/skills/pull-frequency', { schema: { querystring: PerfRangeQuery, response: { 200: SkillsPullFrequencyReport } } }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    return service.skillsPullFrequency(workspaceId, toPerfRange(req.query));
  });

  app.get('/skills/:id/stats', { schema: { params: IdParams, querystring: PerfRangeQuery, response: { 200: SkillStatsReport } } }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    return service.skillStats(workspaceId, req.params.id, toPerfRange(req.query));
  });
}
