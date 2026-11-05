import type { AgentPerformanceReport, AgentStatsReport, SkillStatsReport, SkillsPullFrequencyReport } from '@devdigest/shared';
import type { Db } from '../../db/client.js';
import { NotFoundError } from '../../platform/errors.js';
import { buildDashboard, buildSkillStats, buildSkillsPullFrequency, buildStats } from './helpers.js';
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
    // One findings read (F-11): the breakdown over both windows is the tallies split
    // by category and severity, so it serves as both — summed by the same `foldFigures`
    // the dashboard row uses (R-01) and folded per category/severity (R-26).
    const [groups, breakdown] = await Promise.all([
      repo.runGroups(workspaceId, range, agent.id),
      repo.findingBreakdown(workspaceId, range, [agent.id], 'both'),
    ]);
    return buildStats(range, agent, groups, breakdown, breakdown);
  }

  /**
   * GET /skills/:id/stats (L08 skill-stats, D-8). The counted runs of the agents
   * that use the skill now. Probe first (R-23); then the skill lookup, its users and
   * the two PR counts in parallel (F-07) — every one is workspace-scoped, so a foreign
   * id reads nothing of another tenant, and an unknown or foreign skill is a 404
   * (R-21) before any figure is built. The per-agent reads need the user ids.
   */
  async skillStats(workspaceId: string, skillId: string, range: PerfRange): Promise<SkillStatsReport> {
    const { repo } = this.deps;
    await repo.assertTimeZoneKnown(range.tz);
    const [skill, agents, reviewed, withSkill] = await Promise.all([
      repo.getSkill(workspaceId, skillId),
      repo.usingAgents(workspaceId, skillId),
      repo.reviewedPrCount(workspaceId, range),
      repo.prsWithSkill(workspaceId, range, skillId),
    ]);
    if (!skill) throw new NotFoundError('Skill not found');
    const ids = agents.map((a) => a.id);
    const [runCounts, rows] = await Promise.all([
      repo.runCountsByAgent(workspaceId, range, ids),
      repo.findingBreakdown(workspaceId, range, ids),
    ]);
    return buildSkillStats(range, skill, agents, runCounts, rows, reviewed, withSkill.get(skill.id) ?? 0);
  }

  /**
   * GET /skills/pull-frequency — every skill of the workspace, by the same two
   * counts as `skillStats`, so a card and its Stats tab agree (D-7, R-18).
   */
  async skillsPullFrequency(workspaceId: string, range: PerfRange): Promise<SkillsPullFrequencyReport> {
    const { repo } = this.deps;
    await repo.assertTimeZoneKnown(range.tz);
    const [skillIds, reviewed, withSkill] = await Promise.all([
      repo.listSkillIds(workspaceId),
      repo.reviewedPrCount(workspaceId, range),
      repo.prsWithSkill(workspaceId, range),
    ]);
    return buildSkillsPullFrequency(range, skillIds, reviewed, withSkill);
  }
}
