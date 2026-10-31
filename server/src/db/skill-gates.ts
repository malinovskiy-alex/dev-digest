import { and, eq, type SQL } from 'drizzle-orm';
import * as t from './schema.js';

/**
 * THE "active skill on an agent" predicate — the one definition of when a
 * skill's contribution (its body, its project-context documents) reaches an
 * agent's prompt. Two independent gates plus a tenancy check:
 *
 *   - the agent has the skill's row checked (`agent_skills.enabled`),
 *   - the skill is on globally, on the Skills page (`skills.enabled`),
 *   - the skill lives in the agent's workspace (a link row is written from a
 *     caller-supplied id, so this is the last place a foreign skill is stopped).
 *
 * Every query that answers "what does this agent get through its skills" uses
 * it, so the prompt, the Context tab's inherited rows and "Used by N" cannot
 * drift apart. The query MUST join `agent_skills`, `skills` and `agents`.
 *
 * It lives beside the schema rather than in a module because two repositories
 * (skills: bodies + inherited docs; agents: "Used by N") need it, and a module
 * may not import a sibling's folder.
 */
export function activeSkillOnAgent(): SQL {
  return and(
    eq(t.agentSkills.enabled, true),
    eq(t.skills.enabled, true),
    eq(t.skills.workspaceId, t.agents.workspaceId),
  )!;
}
