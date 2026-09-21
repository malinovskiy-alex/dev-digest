/**
 * Control-experiment fixtures for L02 (see specs/L02-skills-in-the-product.md §9).
 *
 * Two pull requests whose diffs are designed to be MISSED by a competent
 * reviewer with no skills attached, and CAUGHT once the relevant skill is
 * attached. They are the A/B the lesson demonstrates: same PR, same model, one
 * block of text added to the prompt.
 *
 * The diffs live here as `pr_files.patch` text because that is what the review
 * path actually reads: `loadDiff` tries `git diff base...head` first and falls
 * back to reconstructing a unified diff from the persisted patches
 * (`modules/reviews/diff-loader.ts`). A seeded PR has no clone, so the patch
 * column IS the diff. A fixture without it would produce an empty review.
 *
 * Writing these is a balancing act. Too obvious and the no-skills arm catches
 * it, so the experiment shows nothing; too obscure and the with-skills arm
 * misses it too. Both are tuned so the defect is real and consequential but
 * reads as tidy code at a glance — which is exactly the case a checklist beats
 * a general impression.
 */

export interface FixtureFile {
  path: string;
  additions: number;
  deletions: number;
  /** Unified-diff hunks. `diff --git` / `---` / `+++` are added by the loader. */
  patch: string;
}

export interface FixturePull {
  number: number;
  title: string;
  author: string;
  branch: string;
  base: string;
  headSha: string;
  body: string;
  files: FixtureFile[];
  commitMessage: string;
  /** Which agent this arm of the experiment runs on, and what should surface. */
  note: string;
}

/**
 * PR #483 — the test-quality arm.
 *
 * `applyDiscount` has three branches and the test exercises exactly one. The
 * interesting one is `pct > 100`: nothing rejects it, so a 120% discount
 * returns a NEGATIVE total and the caller refunds money. There is no missing
 * `if` that looks conspicuous — the gap is only visible if you enumerate the
 * branches, which is what `uncovered-branch-gate` instructs. `subtotal === 0`
 * and the `pct <= 0` early return are the second and third gaps, and the
 * boundary row of `corner-case-checklist` is what surfaces them.
 */
export const PR_483: FixturePull = {
  number: 483,
  title: 'Add percentage discounts to order totals',
  author: 'dev.ortiz',
  branch: 'feat/order-discounts',
  base: 'main',
  headSha: 'c7d8e9f0a1b2',
  body:
    'Adds `applyDiscount` so promo codes can take a percentage off an order ' +
    'subtotal. Unit-tested. Rounding matches the existing `round2` behaviour ' +
    'used elsewhere in billing.',
  commitMessage: 'Add applyDiscount + unit test',
  note:
    'Run on Test Quality Reviewer. With skills: the uncovered `pct > 100` ' +
    'branch (negative total) and the zero-subtotal boundary. Without: passes.',
  files: [
    {
      path: 'src/billing/discount.ts',
      additions: 15,
      deletions: 0,
      patch: `@@ -0,0 +1,15 @@
+/** Order totals. Amounts are in currency units, rounded to two places. */
+
+export function round2(n: number): number {
+  return Math.round(n * 100) / 100;
+}
+
+/**
+ * Apply a percentage discount to a subtotal.
+ * \`pct\` is a percentage, not a fraction: 10 means 10% off.
+ */
+export function applyDiscount(subtotal: number, pct: number): number {
+  if (pct <= 0) return subtotal;
+  const discount = subtotal * (pct / 100);
+  return round2(subtotal - discount);
+}`,
    },
    {
      path: 'src/billing/discount.test.ts',
      additions: 8,
      deletions: 0,
      patch: `@@ -0,0 +1,8 @@
+import { describe, it, expect } from 'vitest';
+import { applyDiscount } from './discount';
+
+describe('applyDiscount', () => {
+  it('takes the percentage off the subtotal', () => {
+    expect(applyDiscount(200, 10)).toBe(180);
+  });
+});`,
    },
  ],
};

/**
 * PR #484 — the API-contract arm.
 *
 * A rename that is entirely self-consistent inside the diff: the parameter and
 * the response field are renamed together, the types line up, and nothing looks
 * broken. The break is OUTSIDE the diff — `user_id` → `user` changes the
 * response shape for every existing client, and no caller was updated here.
 *
 * That is precisely the blind spot `api-contract-gate` is written for: it
 * instructs the reviewer to treat a changed interface as breaking until the
 * diff shows the callers moving with it, and to say plainly that no caller was
 * updated rather than guessing how many broke.
 */
export const PR_484: FixturePull = {
  number: 484,
  title: 'Tidy up review list response field names',
  author: 'sam.iqbal',
  branch: 'chore/reviews-response-naming',
  base: 'main',
  headSha: 'd4e5f6a7b8c9',
  body:
    'Small naming cleanup in the reviews endpoint — `user_id` was the only ' +
    'snake_case field left in that response, and the parameter name now matches ' +
    'it. No behaviour change.',
  commitMessage: 'Rename user_id to user in review summaries',
  note:
    'Run on General Reviewer with api-contract-gate attached. With the skill: ' +
    'the response-shape break for existing clients. Without: reads as a tidy rename.',
  files: [
    {
      path: 'src/api/reviews.ts',
      additions: 5,
      deletions: 5,
      patch: `@@ -12,15 +12,15 @@ import { reviews } from '../db/schema';
 export interface ReviewSummary {
   id: string;
-  user_id: string;
+  user: string;
   score: number;
 }

 /** Most recent reviews for one user, newest first. */
-export async function listReviews(userId: string, limit = 20): Promise<ReviewSummary[]> {
+export async function listReviews(user: string, limit = 20): Promise<ReviewSummary[]> {
   const rows = await db
     .select()
     .from(reviews)
-    .where(eq(reviews.userId, userId))
+    .where(eq(reviews.userId, user))
     .orderBy(desc(reviews.createdAt))
     .limit(limit);
-  return rows.map((r) => ({ id: r.id, user_id: r.userId, score: r.score }));
+  return rows.map((r) => ({ id: r.id, user: r.userId, score: r.score }));
 }`,
    },
  ],
};

export const FIXTURE_PULLS: readonly FixturePull[] = [PR_483, PR_484];
