import type { Skill } from "@devdigest/shared";

/** Case-insensitive filter over a skill's name + description. */
export function filterSkills(skills: Skill[], search: string): Skill[] {
  const q = search.trim().toLowerCase();
  if (!q) return skills;
  return skills.filter((s) => `${s.name} ${s.description}`.toLowerCase().includes(q));
}

/**
 * The selected skill, or null. A selection survives a filter change but not the
 * skill disappearing (deleted elsewhere, or never in this workspace), so the
 * rail always agrees with the grid.
 */
export function resolveSelected(skills: Skill[], selectedId: string | null): string | null {
  if (!selectedId) return null;
  return skills.some((s) => s.id === selectedId) ? selectedId : null;
}
