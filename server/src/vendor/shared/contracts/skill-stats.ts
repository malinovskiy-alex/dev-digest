import { z } from 'zod';
import { AgentPerfFigures, AppliedRange, FindingsBreakdown } from './agent-performance.js';

/**
 * L08 follow-up — Skill Stats. The agent-performance counted-run rule, attributed to skills:
 *   GET /skills/:id/stats?from&to&tz       → SkillStatsReport
 *   GET /skills/pull-frequency?from&to&tz  → SkillsPullFrequencyReport
 * Querystring: PerfRangeQuery (`bucket` ignored). An agent uses a skill when, at request
 * time, it is in the workspace, has the skill checked, and the skill is on globally
 * (server db/skill-gates.ts) — current attachment, not run-time (R-01, R-02).
 */

/** Share of reviewed PRs that had a counted run of an agent using the skill (R-07 … R-10). */
export const PullFrequency = z.object({
  /** distinct PRs with a counted run of an agent using the skill */
  prs_with_skill: z.number().int().nonnegative(),
  /** distinct PRs with any counted run in the range, deleted agents included */
  prs_reviewed: z.number().int().nonnegative(),
  /** prs_with_skill / prs_reviewed, 0..1; null when prs_reviewed = 0 */
  rate: z.number().min(0).max(1).nullable(),
});
export type PullFrequency = z.infer<typeof PullFrequency>;

export const SkillStatsAgent = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  /** counted runs in the range, 0 included (R-79) */
  runs: z.number().int().nonnegative(),
});
export type SkillStatsAgent = z.infer<typeof SkillStatsAgent>;

/** A skill's accept figures — field for field an agent's (R-13, R-16). */
export const SkillFindingFigures = AgentPerfFigures.pick({
  accepted: true, dismissed: true, pending: true, decided: true, accept_rate: true,
});
export type SkillFindingFigures = z.infer<typeof SkillFindingFigures>;

export const SkillStatsReport = z.object({
  range: AppliedRange,
  skill: z.object({ id: z.string(), name: z.string(), enabled: z.boolean() }),
  /** agents using the skill now — equals the card's agent count (R-05) */
  used_by: z.number().int().nonnegative(),
  /** of those, agents with at least one counted run in the range (R-06) */
  ran_in_period: z.number().int().nonnegative(),
  pull_frequency: PullFrequency,
  figures: SkillFindingFigures,
  /** findings.total is the Findings KPI (R-12) */
  findings: FindingsBreakdown,
  /** every agent using the skill, name asc then id (R-42) */
  agents: z.array(SkillStatsAgent),
});
export type SkillStatsReport = z.infer<typeof SkillStatsReport>;

export const SkillPullFrequency = z.object({ skill_id: z.string(), pull_frequency: PullFrequency });
export type SkillPullFrequency = z.infer<typeof SkillPullFrequency>;

export const SkillsPullFrequencyReport = z.object({
  range: AppliedRange,
  /** one entry per skill of the workspace, name asc then id (R-20) */
  skills: z.array(SkillPullFrequency),
});
export type SkillsPullFrequencyReport = z.infer<typeof SkillsPullFrequencyReport>;
