import type { SkillType } from "@devdigest/shared";

/** Skill type → badge colour, so the four kinds stay distinguishable at a glance. */
export const SKILL_TYPE_COLOR: Record<SkillType, string> = {
  rubric: "var(--accent)",
  convention: "#8b5cf6",
  security: "var(--crit)",
  custom: "var(--text-secondary)",
};
