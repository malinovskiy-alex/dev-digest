import type { Skill, SkillType } from "@devdigest/shared";

/** The editable half of a skill. `source`, `enabled` and `version` are not
    user-editable here: the toggle owns `enabled`, the server owns the rest. */
export interface SkillDraft {
  name: string;
  description: string;
  type: SkillType;
  body: string;
}

/** Seed the edit form from the stored skill. */
export function toDraft(skill: Skill): SkillDraft {
  return {
    name: skill.name,
    description: skill.description,
    type: skill.type,
    body: skill.body,
  };
}

/**
 * Only what the user actually changed. Sending an unchanged body would be a
 * no-op on the server (it compares before versioning), but a patch that carries
 * exactly the edit makes the request — and the test that reads it — honest.
 */
export function changedFields(skill: Skill, draft: SkillDraft): Partial<SkillDraft> {
  const patch: Partial<SkillDraft> = {};
  if (draft.name !== skill.name) patch.name = draft.name;
  if (draft.description !== skill.description) patch.description = draft.description;
  if (draft.type !== skill.type) patch.type = draft.type;
  if (draft.body !== skill.body) patch.body = draft.body;
  return patch;
}

/** D6: anything that did not come from `manual` is somebody else's text. */
export function isUntrusted(skill: Skill): boolean {
  return skill.source !== "manual";
}
