import type { Skill, SkillType } from "@devdigest/shared";
import { TYPE_COLOR } from "./constants";

/** Resolve the badge colour for a skill's type. */
export function typeColor(type: SkillType): string {
  return TYPE_COLOR[type];
}

/**
 * D6 (the trust model): a skill that came from outside is somebody else's
 * instructions. It is stored disabled and stays flagged until a human has read
 * the body and enabled it. Once enabled, the badge goes away.
 */
export function needsVetting(skill: Skill): boolean {
  return skill.source !== "manual" && !skill.enabled;
}
