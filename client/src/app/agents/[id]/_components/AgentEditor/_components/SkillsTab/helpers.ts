import type { AgentSkillLink, Skill } from "@devdigest/shared";
import type { AgentSkillEntry } from "@/lib/hooks/agents";

/**
 * One line of the agent's skill list: the skill, and whether it reaches the
 * prompt. A row exists for EVERY workspace skill — an unchecked one is a
 * position the user parked, not an absence, which is why the list does not
 * reshuffle when a box is cleared.
 */
export interface SkillListRow {
  skill: Skill;
  enabled: boolean;
}

/**
 * The full list in display order: stored links first, in `agent_skills.order`,
 * then every skill the agent has never been given a position for, alphabetically
 * and off. A link whose skill is gone (deleted, or another workspace's) is
 * dropped rather than rendered as a blank row.
 */
export function buildRows(
  skills: readonly Skill[],
  links: readonly AgentSkillLink[],
): SkillListRow[] {
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const positioned = [...links]
    .sort((a, b) => a.order - b.order)
    .map((link) => {
      const skill = byId.get(link.skill_id);
      return skill ? { skill, enabled: link.enabled } : undefined;
    })
    .filter((row): row is SkillListRow => row !== undefined);

  const seen = new Set(positioned.map((row) => row.skill.id));
  const rest = skills
    .filter((skill) => !seen.has(skill.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((skill) => ({ skill, enabled: false }));

  return [...positioned, ...rest];
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
 * A new list with the row at `from` lifted out and dropped at `to`. Out-of-range
 * indices return the list unchanged, so a drop on nothing — or a key press on a
 * row that is already first — cannot corrupt the order.
 */
export function moveRow(rows: readonly SkillListRow[], from: number, to: number): SkillListRow[] {
  if (from === to) return [...rows];
  if (from < 0 || from >= rows.length || to < 0 || to >= rows.length) return [...rows];
  const next = [...rows];
  const [lifted] = next.splice(from, 1);
  if (lifted === undefined) return [...rows];
  next.splice(to, 0, lifted);
  return next;
}

/** Flip one row's flag, addressed by skill id rather than by a filtered index. */
export function toggleRow(
  rows: readonly SkillListRow[],
  skillId: string,
  enabled: boolean,
): SkillListRow[] {
  return rows.map((row) => (row.skill.id === skillId ? { ...row, enabled } : row));
}

/** The wire shape: the whole list, in order, each row with its flag. */
export function toEntries(rows: readonly SkillListRow[]): AgentSkillEntry[] {
  return rows.map((row) => ({ skill_id: row.skill.id, enabled: row.enabled }));
}

/** How many rows reach the prompt — the "{linked} of {total} enabled" numerator. */
export function countEnabled(rows: readonly SkillListRow[]): number {
  return rows.filter((row) => row.enabled).length;
}
