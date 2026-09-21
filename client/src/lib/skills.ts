import type { Skill, SkillType } from "@devdigest/shared";

/**
 * Case-insensitive filter over a skill's name + description. Shared by the
 * skills grid (`/skills`) and the editor's left-hand list (`/skills/:id`),
 * which must narrow the same way — a search that means two different things on
 * two screens is worse than no search.
 */
export function filterSkills(skills: Skill[], search: string): Skill[] {
  const q = search.trim().toLowerCase();
  if (!q) return skills;
  return skills.filter((s) => `${s.name} ${s.description}`.toLowerCase().includes(q));
}

/**
 * Skill type → badge colour. The four types are the only axis a reader has for
 * telling two same-shaped rows apart at a glance, so each gets its own hue.
 *
 * ONE map, in lib, because the same type must not be one colour on the skills
 * grid and another in the agent's Skills tab — which is exactly what two
 * copies of it produced.
 */
const TYPE_COLOR: Record<SkillType, string> = {
  rubric: "#3b82f6",
  convention: "#10b981",
  security: "#f59e0b",
  custom: "#8b5cf6",
};

/** Resolve the badge colour for a skill's type. */
export function typeColor(type: SkillType): string {
  return TYPE_COLOR[type];
}
