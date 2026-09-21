import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { SkillSource, SkillType } from '@devdigest/shared';
import { isBodyChange } from './helpers.js';

/**
 * A1 — skills data-access. Owns `skills` and `skill_versions`; reads the
 * `agent_skills` link table that A2 (agents) owns, for the two questions only
 * this module can answer — "how many agents use this skill" and "which bodies
 * go into this agent's prompt". Workspace-scoped throughout.
 */

import type { SkillRow, SkillVersionRow } from '../../db/rows.js';
export type { SkillRow, SkillVersionRow };

/** The first version every skill starts at; `skill_versions` holds it too. */
const INITIAL_SKILL_VERSION = 1;

export interface InsertSkill {
  workspaceId: string;
  name: string;
  description: string;
  type: SkillType;
  source: SkillSource;
  body: string;
  /** Default true. The import path passes false — an imported skill is vetted
   *  before it can reach a prompt (spec D6). */
  enabled?: boolean;
  evidenceFiles?: string[];
}

export interface UpdateSkill {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
}

/**
 * One skill body as the review path consumes it. `version` is carried so the
 * run log can name what actually went into the prompt.
 */
export interface PromptSkill {
  id: string;
  name: string;
  version: number;
  body: string;
}

export class SkillsRepository {
  constructor(private db: Db) {}

  /** Every skill in the workspace, `name` ascending (the list screen's order). */
  async list(workspaceId: string): Promise<SkillRow[]> {
    return this.db
      .select()
      .from(t.skills)
      .where(eq(t.skills.workspaceId, workspaceId))
      .orderBy(asc(t.skills.name));
  }

  async getById(workspaceId: string, id: string): Promise<SkillRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    return row;
  }

  /** Resolve many ids at once, still workspace-scoped. Ids from another
   *  workspace simply do not come back — the caller sees a short list, not a 403. */
  async getManyByIds(workspaceId: string, ids: string[]): Promise<SkillRow[]> {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), inArray(t.skills.id, ids)));
  }

  /** Insert a skill AND record version 1 in skill_versions (every revision,
   *  including the current one, is in that table). */
  async insert(values: InsertSkill): Promise<SkillRow> {
    const [row] = await this.db
      .insert(t.skills)
      .values({
        workspaceId: values.workspaceId,
        name: values.name,
        description: values.description,
        type: values.type,
        source: values.source,
        body: values.body,
        enabled: values.enabled ?? true,
        version: INITIAL_SKILL_VERSION,
        ...(values.evidenceFiles !== undefined ? { evidenceFiles: values.evidenceFiles } : {}),
      })
      .returning();
    await this.snapshotBody(row!.id, INITIAL_SKILL_VERSION, row!.body);
    return row!;
  }

  /**
   * Update a skill. ONLY a changed body bumps the version and appends the new
   * body to skill_versions — renaming a skill, rewording its description,
   * changing its type or flipping `enabled` leave the version alone.
   */
  async update(
    workspaceId: string,
    id: string,
    patch: UpdateSkill,
  ): Promise<SkillRow | undefined> {
    const existing = await this.getById(workspaceId, id);
    if (!existing) return undefined;

    const bodyChanged = isBodyChange(existing, patch);
    const nextVersion = bodyChanged ? existing.version + 1 : existing.version;

    const [row] = await this.db
      .update(t.skills)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.body !== undefined ? { body: patch.body } : {}),
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(bodyChanged ? { version: nextVersion } : {}),
      })
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning();

    if (bodyChanged && row) await this.snapshotBody(row.id, nextVersion, row.body);
    return row;
  }

  /** Delete a skill (scoped to workspace). `agent_skills` links cascade at the
   *  DB level, so attached agents silently lose it — the service reads
   *  `countAgentsUsing` BEFORE calling this to report how many. Returns false
   *  if no such skill existed in the workspace. */
  async deleteById(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning({ id: t.skills.id });
    return rows.length > 0;
  }

  private async snapshotBody(skillId: string, version: number, body: string): Promise<void> {
    await this.db
      .insert(t.skillVersions)
      .values({ skillId, version, body })
      .onConflictDoNothing();
  }

  // ---- skill_versions (immutable body revisions) --------------------------

  /** Every body revision of a skill, newest version first. Scoping happens one
   *  level up: the service resolves the skill in the workspace first. */
  async listVersions(skillId: string): Promise<SkillVersionRow[]> {
    return this.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skillId))
      .orderBy(desc(t.skillVersions.version));
  }

  // ---- agent_skills (read-only here; A2 owns the writes) ------------------

  /**
   * Checked-row counts for several skills in ONE query, keyed by skill id.
   * The grid renders a count per card, and a per-card read would be a query per
   * row. Skills nothing uses are simply absent from the map.
   */
  async agentCountsFor(workspaceId: string, skillIds: string[]): Promise<Map<string, number>> {
    if (skillIds.length === 0) return new Map();
    const rows = await this.db
      .select({ skillId: t.agentSkills.skillId, n: count() })
      .from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .where(
        and(
          inArray(t.agentSkills.skillId, skillIds),
          eq(t.agentSkills.enabled, true),
          eq(t.agents.workspaceId, workspaceId),
        ),
      )
      .groupBy(t.agentSkills.skillId);
    return new Map(rows.map((r) => [r.skillId, r.n]));
  }

  /** How many agents IN THIS WORKSPACE actually use this skill — the reuse
   *  signal on the card and the "used by N agents" delete confirmation. A row
   *  the user unchecked is a parked position, not a use, so it does not count:
   *  deleting the skill would change nothing about that agent's prompt. */
  async countAgentsUsing(workspaceId: string, skillId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .where(
        and(
          eq(t.agentSkills.skillId, skillId),
          eq(t.agentSkills.enabled, true),
          eq(t.agents.workspaceId, workspaceId),
        ),
      );
    return row?.n ?? 0;
  }

  /**
   * The agents in this workspace whose PROMPT contains this skill. Read BEFORE a
   * delete: `agent_skills` cascades with the skill, so afterwards the answer is
   * always empty — and those agents' versions still have to move. An unchecked
   * row is excluded for the same reason it is excluded from `countAgentsUsing`:
   * losing it does not change what that agent sends.
   */
  async agentIdsUsing(workspaceId: string, skillId: string): Promise<string[]> {
    const rows = await this.db
      .select({ agentId: t.agentSkills.agentId })
      .from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .where(
        and(
          eq(t.agentSkills.skillId, skillId),
          eq(t.agentSkills.enabled, true),
          eq(t.agents.workspaceId, workspaceId),
        ),
      );
    return rows.map((r) => r.agentId);
  }

  /**
   * Ordered bodies for an agent's prompt: attached order, globally-enabled
   * only. THE one read the review path uses — a disabled skill produces no row
   * here, so it leaves no trace in the prompt or the run log.
   *
   * Takes no `workspaceId` — the caller has already resolved the agent inside
   * its workspace — but the query joins `agents` and requires the skill's
   * workspace to match the agent's anyway. A link row is written from a
   * caller-supplied id, so this is the last place a foreign skill's body could
   * be stopped before it becomes instructions in someone's prompt (D6). One
   * extra join is a cheap price for not having that depend on every future
   * caller of `POST /agents/:id/skills` remembering to validate.
   */
  async promptBodiesForAgent(agentId: string): Promise<PromptSkill[]> {
    return this.db
      .select({
        id: t.skills.id,
        name: t.skills.name,
        version: t.skills.version,
        body: t.skills.body,
      })
      .from(t.agentSkills)
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .where(
        and(
          eq(t.agentSkills.agentId, agentId),
          // Two independent gates: the skill is on globally (Skills page) AND
          // this agent has its row checked. Either one off keeps it out.
          eq(t.agentSkills.enabled, true),
          eq(t.skills.enabled, true),
          eq(t.skills.workspaceId, t.agents.workspaceId),
        ),
      )
      .orderBy(asc(t.agentSkills.order));
  }
}
