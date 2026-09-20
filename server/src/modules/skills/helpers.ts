import type { Skill, SkillSource, SkillType, SkillVersion } from '@devdigest/shared';

/**
 * Pure helpers for the skills module — DB row ⇄ DTO mapping and the
 * body-version-bump rule. No I/O.
 *
 * The row shapes below are declared STRUCTURALLY rather than imported. This
 * file is Ring 1, so `core-no-io` forbids it from reaching into `src/db/`, and
 * importing the row from `./repository.ts` would close a cycle (the repository
 * imports these mappers) — `no-circular` rejects that. Drizzle's inferred
 * `SkillRow` / `SkillVersionRow` are structurally assignable to these, so the
 * repository passes its rows straight in and nothing is cast at the call site.
 *
 * The agents module has the cycle this file avoids; it predates the rule and is
 * grandfathered in the baseline. New modules do not get to inherit that.
 */

/** The persisted `skills` columns these mappers read. */
export interface SkillRowShape {
  id: string;
  name: string;
  description: string;
  type: string;
  source: string;
  body: string;
  enabled: boolean;
  version: number;
  evidenceFiles: string[] | null;
}

/** The persisted `skill_versions` columns these mappers read. */
export interface SkillVersionRowShape {
  skillId: string;
  version: number;
  body: string;
  createdAt: Date;
}

/** Map a persisted skill row to the public `Skill` DTO. */
export function toSkillDto(row: SkillRowShape): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as SkillType,
    source: row.source as SkillSource,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: row.evidenceFiles ?? null,
  };
}

/**
 * Map a persisted `skill_versions` row to the public `SkillVersion` DTO. Unlike
 * an agent's snapshot this is plain columns, not jsonb, so there is nothing to
 * re-parse — the row IS the revision.
 */
export function toSkillVersionDto(row: SkillVersionRowShape): SkillVersion {
  return {
    skill_id: row.skillId,
    version: row.version,
    body: row.body,
    created_at: row.createdAt.toISOString(),
  };
}

/** The one field whose change bumps a skill's version. */
export interface BodyChangePatch {
  body?: string;
}

/**
 * True when a patch changes the skill's body relative to the existing row — a
 * body change bumps `version` and appends the NEW body to `skill_versions`.
 * Name / description / type / enabled edits never bump: the version numbers a
 * user sees in the prompt trace must mean "the text changed", nothing else.
 */
export function isBodyChange(
  existing: Pick<SkillRowShape, 'body'>,
  patch: BodyChangePatch,
): boolean {
  return patch.body !== undefined && patch.body !== existing.body;
}
