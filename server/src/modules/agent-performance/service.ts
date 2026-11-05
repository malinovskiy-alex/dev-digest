import type { AgentPerformanceReport, AgentStatsReport } from '@devdigest/shared';
import type { Db } from '../../db/client.js';
import { NotFoundError } from '../../platform/errors.js';
import { buildDashboard, buildStats } from './helpers.js';
import { PerformanceRepository } from './repository.js';
import type { AgentPerformanceDeps, PerfRange } from './types.js';

/**
 * agent-performance (L08) — one aggregation, two reads. Stored rows only: no
 * model, no GitHub, no job, no write (R-29). Both reads go through the same
 * folds in `helpers.ts` (R-01).
 *
 * The constructor takes the read port, so a unit test passes a fake and needs
 * no Postgres; `fromDb` is the production wiring, where the service builds its
 * own module's repository (the one `new` a service may do) and the route never
 * sees Ring 3.
 */
export class AgentPerformanceService {
  constructor(private deps: AgentPerformanceDeps) {}

  static fromDb(db: Db): AgentPerformanceService {
    return new AgentPerformanceService({ repo: new PerformanceRepository(db) });
  }

  async dashboard(workspaceId: string, range: PerfRange): Promise<AgentPerformanceReport> {
    const { repo } = this.deps;
    // Probe the zone before any read: a Postgres-unknown zone is a 422 even on an empty window (F-09).
    await repo.assertTimeZoneKnown(range.tz);
    const [agents, groups, tallies, buckets] = await Promise.all([
      repo.listAgents(workspaceId),
      repo.runGroups(workspaceId, range),
      repo.findingTallies(workspaceId, range),
      repo.runBuckets(workspaceId, range),
    ]);
    return buildDashboard(range, agents, groups, tallies, buckets);
  }

  async agentStats(workspaceId: string, agentId: string, range: PerfRange): Promise<AgentStatsReport> {
    const { repo } = this.deps;
    // Same probe as the dashboard, so both routes reject a Postgres-unknown zone alike (F-09).
    await repo.assertTimeZoneKnown(range.tz);
    // Workspace-scoped lookup first: an unknown or foreign id is a 404 (R-27).
    const agent = await repo.getAgent(workspaceId, agentId);
    if (!agent) throw new NotFoundError('Agent not found');
    const [groups, tallies] = await Promise.all([
      repo.runGroups(workspaceId, range, agent.id),
      repo.findingTallies(workspaceId, range, agent.id),
    ]);
    return buildStats(range, agent, groups, tallies);
  }
}
