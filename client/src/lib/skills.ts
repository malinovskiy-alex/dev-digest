import type { Skill } from "@devdigest/shared";

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
