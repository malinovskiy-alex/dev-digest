import type { AgentSkillLink, Skill } from "@devdigest/shared";

/**
 * An attached skill plus its index in the FULL ordered list. Reorder maths must
 * use this index and never the position of a row in the filtered view.
 */
export interface AttachedSkill {
  skill: Skill;
  index: number;
}

export interface SkillPartition {
  /** Attached, in stored prompt order (`agent_skills.order` ascending). */
  attached: AttachedSkill[];
  /** Everything else, alphabetically by name. */
  available: Skill[];
}

/**
 * The attached skill ids in prompt order. The API already returns the links
 * ordered; sorting here makes the order a property of the data rather than of
 * the transport.
 */
export function orderedSkillIds(links: readonly AgentSkillLink[]): string[] {
  return [...links].sort((a, b) => a.order - b.order).map((link) => link.skill_id);
}

/** Split the workspace's skills into the agent's ordered set and the rest. */
export function partitionSkills(
  skills: readonly Skill[],
  orderedIds: readonly string[],
): SkillPartition {
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  // A link whose skill no longer exists (deleted, or another workspace's) is
  // dropped rather than rendered as a blank row.
  const attached = orderedIds
    .map((id) => byId.get(id))
    .filter((skill): skill is Skill => skill !== undefined)
    .map((skill, index) => ({ skill, index }));
  const linked = new Set(attached.map((entry) => entry.skill.id));
  const available = skills
    .filter((skill) => !linked.has(skill.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { attached, available };
}

/** Case-insensitive match over the skill's name and description. */
export function matchesFilter(skill: Skill, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  return (
    skill.name.toLowerCase().includes(needle) ||
    skill.description.toLowerCase().includes(needle)
  );
}

/**
 * A new ordered array with the entry at `index` swapped with its neighbour.
 * Out-of-range moves return the list unchanged, so a disabled button that is
 * somehow activated cannot corrupt the order.
 */
export function moveSkill(ids: readonly string[], index: number, delta: -1 | 1): string[] {
  const next = [...ids];
  const target = index + delta;
  const from = next[index];
  const to = next[target];
  if (from === undefined || to === undefined) return next;
  next[index] = to;
  next[target] = from;
  return next;
}
