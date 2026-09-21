import type { SkillType } from "@devdigest/shared";

/**
 * Skill type -> badge colour. The four types are the only axis a reader has for
 * telling two same-shaped cards apart at a glance, so each gets its own hue
 * (mirrors AgentCard's MODEL_COLOR, which does the same job for models).
 */
export const TYPE_COLOR: Record<SkillType, string> = {
  rubric: "#3b82f6",
  convention: "#10b981",
  security: "#f59e0b",
  custom: "#8b5cf6",
};
