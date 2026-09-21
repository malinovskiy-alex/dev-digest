import type { ConventionCategory } from "@devdigest/shared";

/**
 * The convention categories, as a runtime list for the card's picker.
 *
 * Deliberately NOT `ConventionCategory.options` from `@devdigest/shared`, for
 * the same reason `skill-types.ts` avoids `SkillType.options`: importing the Zod
 * enum is a **runtime** import from the vendored barrel, whose `./contracts/*.js`
 * specifiers the Next bundler cannot resolve — it breaks every route, not just
 * this screen, while the unit suite stays green. Types only from that package.
 *
 * The check below keeps the list honest: add a member to the contract and this
 * file stops compiling until it is listed here too.
 */
export const CONVENTION_CATEGORIES = [
  "naming",
  "structure",
  "error-handling",
  "async",
  "typing",
  "testing",
  "imports",
  "api",
  "docs",
  "other",
] as const;

/** Compile-time exhaustiveness: no `ConventionCategory` may be missing. */
type MissingCategory = Exclude<ConventionCategory, (typeof CONVENTION_CATEGORIES)[number]>;
const _allCategoriesListed: MissingCategory extends never ? true : never = true;
void _allCategoriesListed;
