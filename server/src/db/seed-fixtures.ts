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

/**
 * PR #485 — the L03 arm, and the one that shows what a BAD fixture looks like.
 *
 * Four contract breaks across four files, with a PR body that points at them
 * ("the sub-route was redundant, so it goes"). On the API Contract Reviewer
 * with its four skills it produces five grounded findings; on the General
 * Reviewer with none it produces four. That is the failure mode this file's
 * header warns about — too obvious, so the control arm catches it too and the
 * A/B shows almost nothing.
 *
 * It is kept because it is the better DEMO: every defect is legible, each maps
 * to exactly one skill, and the one finding only the skills arm reaches (a
 * patch-version bump on a breaking change) is easy to point at on a screen.
 * Use #486 for the experiment and #485 for the walkthrough.
 */
export const PR_485: FixturePull = {
  number: 485,
  title: 'Replace the delivered flag with a status enum',
  author: 'r.whitfield',
  branch: 'chore/notification-status',
  base: 'main',
  headSha: 'e5f6a7b8c9d0',
  body:
    'A boolean could not express "failed", so `delivered` becomes a three-state ' +
    '`status` and we return `failedAt` alongside it. The dedicated `/delivered` ' +
    'sub-route was redundant once the main response carries the state, so it ' +
    'goes. Tests cover all three states plus the not-found path.',
  commitMessage: 'Replace the delivered flag with a status enum',
  note:
    'Run on API Contract Reviewer (breaking-change, deprecation-policy, ' +
    'response-schema, semver-discipline). Demo fixture: the control arm finds ' +
    'most of it too, so use #486 to show the A/B.',
  files: [
    {
      path: 'package.json',
      additions: 1,
      deletions: 1,
      patch: `@@ -1,7 +1,7 @@
 {
   "name": "@acme/notifications",
-  "version": "1.4.0",
+  "version": "1.4.1",
   "main": "dist/index.js",
   "types": "dist/index.d.ts",
   "files": ["dist"],`,
    },
    {
      path: 'src/api/notifications.ts',
      additions: 9,
      deletions: 6,
      patch: `@@ -8,26 +8,30 @@ import { notifications } from '../db/schema';

 export const NotificationResponse = z.object({
   id: z.string(),
   channel: z.enum(['email', 'sms', 'push']),
-  delivered: z.boolean(),
+  status: z.enum(['pending', 'delivered', 'failed']),
+  failedAt: z.string(),
 });

 export type NotificationResponse = z.infer<typeof NotificationResponse>;

 /** One notification, by id. */
 export async function getNotification(id: string): Promise<NotificationResponse> {
   const row = await db
     .select()
     .from(notifications)
     .where(eq(notifications.id, id))
     .then((r) => r[0]);

   if (!row) throw new NotFoundError(\`Notification \${id} not found\`);

-  return {
-    id: row.id,
-    channel: row.channel,
-    delivered: row.deliveredAt !== null,
-  };
+  return {
+    id: row.id,
+    channel: row.channel,
+    status: row.status,
+    attempts: row.attempts,
+    ...(row.failedAt ? { failedAt: row.failedAt.toISOString() } : {}),
+  };
 }`,
    },
    {
      path: 'src/api/routes.ts',
      additions: 0,
      deletions: 5,
      patch: `@@ -21,12 +21,6 @@ export function registerNotificationRoutes(app: FastifyInstance) {
     return getNotification(req.params.id);
   });

-  app.get('/notifications/:id/delivered', async (req) => {
-    const n = await getNotification(req.params.id);
-    return { delivered: n.delivered };
-  });
-
   app.post('/notifications', async (req, reply) => {
     reply.status(201);
     return createNotification(req.body);`,
    },
    {
      path: 'test/notifications.test.ts',
      additions: 19,
      deletions: 9,
      patch: `@@ -4,15 +4,28 @@ import { getNotification } from '../src/api/notifications';

 describe('getNotification', () => {
-  it('reports a delivered notification', async () => {
-    const n = await getNotification(seeded.deliveredId);
-    expect(n.delivered).toBe(true);
-  });
-
-  it('reports an undelivered notification', async () => {
-    const n = await getNotification(seeded.pendingId);
-    expect(n.delivered).toBe(false);
-  });
+  it('reports a delivered notification', async () => {
+    const n = await getNotification(seeded.deliveredId);
+    expect(n.status).toBe('delivered');
+  });
+
+  it('reports a pending notification', async () => {
+    const n = await getNotification(seeded.pendingId);
+    expect(n.status).toBe('pending');
+  });
+
+  it('reports a failed notification with the time it failed', async () => {
+    const n = await getNotification(seeded.failedId);
+    expect(n.status).toBe('failed');
+    expect(n.failedAt).toBe('2026-09-19T08:30:00.000Z');
+  });
+
+  it('throws for an unknown id', async () => {
+    await expect(getNotification('missing')).rejects.toThrow(NotFoundError);
+  });
 });`,
    },
  ],
};

/**
 * PR #486 — the L03 arm, retuned so the control arm has little to say.
 *
 * Every defect here reads as an IMPROVEMENT, which is the only way a competent
 * reviewer with no skills stays quiet: nothing is removed, nothing is renamed,
 * no caller is orphaned inside the diff, and the tests move with the code.
 *
 *   semver-discipline   `retries` gains `.max(10)` — a sane guard that now
 *                       rejects config which used to work, shipped 2.3.4→2.3.5.
 *   breaking-change     `pageSize` default 50→25, framed as a perf tune, so
 *                       every caller relying on the default silently halves.
 *   response-schema     `deliveredAt` required→`.optional()` widens a RESPONSE,
 *                       and `lastError` gains `.default('')`, so a client cannot
 *                       tell "no error" from "empty message".
 *   deprecation-policy  `legacyId` is marked `@deprecated` and nothing else — no
 *                       replacement, no removal version. Marking it looks
 *                       responsible, which is why only a checklist notices that
 *                       two of the four parts are missing.
 *
 * Measured 2026-09-21 on claude-sonnet-5: with the four skills, 5 findings and a
 * score of 0; without them, 1 finding and a score of 65. Four of the five are
 * unique to the skills arm. The control arm is not silent — a changed response
 * schema is visible in the diff text however it is framed — so this is a sharp
 * contrast rather than the clean pass/fail the header wishes for.
 */
export const PR_486: FixturePull = {
  number: 486,
  title: 'Tune delivery defaults and tidy the delivery response',
  author: 'j.okafor',
  branch: 'chore/delivery-polish',
  base: 'main',
  headSha: 'f6a7b8c9d0e1',
  body:
    'Small polish pass on webhook delivery.\n\n' +
    '- `pageSize` now defaults to 25 — the 50-row page was the slowest query on ' +
    'the deliveries dashboard and nobody reads past the first screen.\n' +
    '- `retries` is capped at 10. There was no upper bound, so a typo in config ' +
    'could queue a delivery forever.\n' +
    '- `deliveredAt` is optional, which is honest: an undelivered webhook has no ' +
    'timestamp and we were lying about it.\n' +
    '- `lastError` defaults to an empty string so clients stop null-checking.\n' +
    '- Marked `legacyId` deprecated.\n\n' +
    'No endpoints added or removed. Tests updated.',
  commitMessage: 'Tune delivery defaults and tidy the delivery response',
  note:
    'The A/B arm. Run on API Contract Reviewer with its four skills, then on ' +
    'General Reviewer with none: 5 findings against 1.',
  files: [
    {
      path: 'package.json',
      additions: 1,
      deletions: 1,
      patch: `@@ -1,6 +1,6 @@
 {
   "name": "@acme/webhooks",
-  "version": "2.3.4",
+  "version": "2.3.5",
   "main": "dist/index.js",
   "files": ["dist"],`,
    },
    {
      path: 'src/config.ts',
      additions: 2,
      deletions: 2,
      patch: `@@ -6,10 +6,10 @@ import { z } from 'zod';
 export const DeliveryConfig = z.object({
   /** How many webhook deliveries to return per page. */
-  pageSize: z.number().int().positive().default(50),
+  pageSize: z.number().int().positive().default(25),

   /** How many times to retry a failed delivery. */
-  retries: z.number().int().min(0).default(3),
+  retries: z.number().int().min(0).max(10).default(3),
 });`,
    },
    {
      path: 'src/api/webhooks.ts',
      additions: 4,
      deletions: 3,
      patch: `@@ -9,13 +9,14 @@ import { deliveries } from '../db/schema';

 export const DeliveryResponse = z.object({
   id: z.string(),
   url: z.string(),
-  deliveredAt: z.string(),
-  lastError: z.string().nullable(),
-  legacyId: z.string(),
+  deliveredAt: z.string().optional(),
+  lastError: z.string().default(''),
+  /** @deprecated */
+  legacyId: z.string(),
 });

 export type DeliveryResponse = z.infer<typeof DeliveryResponse>;`,
    },
    {
      path: 'test/config.test.ts',
      additions: 11,
      deletions: 3,
      patch: `@@ -3,8 +3,16 @@ import { DeliveryConfig } from '../src/config';

 describe('DeliveryConfig', () => {
-  it('defaults pageSize', () => {
-    expect(DeliveryConfig.parse({}).pageSize).toBe(50);
-  });
+  it('defaults pageSize', () => {
+    expect(DeliveryConfig.parse({}).pageSize).toBe(25);
+  });
+
+  it('accepts a retry count within the supported range', () => {
+    expect(DeliveryConfig.parse({ retries: 10 }).retries).toBe(10);
+  });
+
+  it('rejects a retry count above the supported range', () => {
+    expect(() => DeliveryConfig.parse({ retries: 11 })).toThrow();
+  });
 });`,
    },
  ],
};

export const FIXTURE_PULLS: readonly FixturePull[] = [PR_483, PR_484, PR_485, PR_486];

