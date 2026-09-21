import type { Skill } from "@devdigest/shared";

/**
 * D6 (the trust model): a skill that came from outside is somebody else's
 * instructions. It is stored disabled and stays flagged until a human has read
 * the body and enabled it. Once enabled, the badge goes away.
 */
export function needsVetting(skill: Skill): boolean {
  return skill.source !== "manual" && !skill.enabled;
}
