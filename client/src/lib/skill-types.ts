import type { SkillType } from "@devdigest/shared";

/**
 * The skill types, as a runtime list for pickers.
 *
 * Deliberately NOT `SkillType.options` from `@devdigest/shared`. Importing that
 * Zod enum is a **runtime** import from the vendored barrel, and the barrel
 * re-exports with `./contracts/*.js` specifiers that the Next bundler cannot
 * resolve — it fails the whole app, not just this screen. Vitest resolves them
 * fine, so the unit suite stays green while `next build` and `next dev` both
 * break. Every other `@devdigest/shared` import in this package is `import
 * type`, which is erased before any bundler sees it; this file exists so it
 * stays that way.
 *
 * The check below keeps the list honest: add a member to the `SkillType`
 * contract and this file stops compiling until it is listed here too.
 */
export const SKILL_TYPES = ["rubric", "convention", "security", "custom"] as const;

/** Compile-time exhaustiveness: no `SkillType` may be missing from the list. */
type MissingSkillType = Exclude<SkillType, (typeof SKILL_TYPES)[number]>;
const _allSkillTypesListed: MissingSkillType extends never ? true : never = true;
void _allSkillTypesListed;
