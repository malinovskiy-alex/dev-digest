import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { Db } from '../../../db/client.js';
import * as t from '../../../db/schema.js';
import { IntentConfidence, IntentKind, IntentSource } from '@devdigest/shared';
import type { PrFile, PrIntentRecord } from '@devdigest/shared';
import type { PullRow } from '../../../db/rows.js';

// ---- PR lookup (workspace-scoped) -----------------------------------------

export async function getPull(
  db: Db,
  workspaceId: string,
  prId: string,
): Promise<PullRow | undefined> {
  const [row] = await db
    .select()
    .from(t.pullRequests)
    .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, prId)));
  return row;
}

export async function getRepo(
  db: Db,
  repoId: string,
): Promise<typeof t.repos.$inferSelect | undefined> {
  const [row] = await db.select().from(t.repos).where(eq(t.repos.id, repoId));
  return row;
}

export async function getPrFiles(
  db: Db,
  prId: string,
): Promise<(typeof t.prFiles.$inferSelect)[]> {
  return db.select().from(t.prFiles).where(eq(t.prFiles.prId, prId));
}

// ---- prior PRs (merged PRs + their cached files) ---------------------------

/** A merged PR of the same repo, as the Prior-PRs block needs it. */
export interface MergedPullRow {
  id: string;
  number: number;
  title: string;
  author: string;
  updatedAt: Date | null;
}

/**
 * Merged PRs DevDigest has synced for this repo, newest update first, excluding
 * `excludePrId`. Scoped by workspace AND repo. ≤50 rows exist per repo (the sync
 * window), so the existing indexes are enough.
 */
export async function listMergedPulls(
  db: Db,
  workspaceId: string,
  repoId: string,
  excludePrId: string,
  limit: number,
): Promise<MergedPullRow[]> {
  return db
    .select({
      id: t.pullRequests.id,
      number: t.pullRequests.number,
      title: t.pullRequests.title,
      author: t.pullRequests.author,
      updatedAt: t.pullRequests.updatedAt,
    })
    .from(t.pullRequests)
    .where(
      and(
        eq(t.pullRequests.workspaceId, workspaceId),
        eq(t.pullRequests.repoId, repoId),
        eq(t.pullRequests.status, 'merged'),
        ne(t.pullRequests.id, excludePrId),
      ),
    )
    .orderBy(sql`${t.pullRequests.updatedAt} desc nulls last`, desc(t.pullRequests.number))
    .limit(limit);
}

/** File paths per PR for many PRs at once — ONE `IN` query. PRs with no rows are absent. */
export async function getPrFilePaths(
  db: Db,
  prIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (prIds.length === 0) return out;
  const rows = await db
    .select({ prId: t.prFiles.prId, path: t.prFiles.path })
    .from(t.prFiles)
    .where(inArray(t.prFiles.prId, prIds));
  for (const r of rows) {
    const arr = out.get(r.prId);
    if (arr) arr.push(r.path);
    else out.set(r.prId, [r.path]);
  }
  return out;
}

/** Replace a PR's files (delete + insert in one transaction) — the same rows the PR-detail route writes. */
export async function replacePrFiles(db: Db, prId: string, files: PrFile[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(t.prFiles).where(eq(t.prFiles.prId, prId));
    if (files.length > 0) {
      await tx.insert(t.prFiles).values(
        files.map((f) => ({
          prId,
          path: f.path,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch ?? null,
        })),
      );
    }
  });
}

/**
 * Record the commit a review just ran against, so the PR list can derive
 * `reviewed` vs `needs_review` (head moved since the last review) vs `stale`.
 */
export async function markReviewed(db: Db, prId: string, sha: string): Promise<void> {
  await db
    .update(t.pullRequests)
    .set({ lastReviewedSha: sha })
    .where(eq(t.pullRequests.id, prId));
}

// ---- intent ---------------------------------------------------------------

/** The cached intent row plus the hash that keys it (null = pre-L03 row → always stale). */
export interface StoredIntent {
  record: PrIntentRecord;
  inputHash: string | null;
}

export async function upsertIntent(
  db: Db,
  prId: string,
  record: PrIntentRecord,
  inputHash: string,
): Promise<void> {
  const values = {
    intent: record.intent,
    inScope: record.in_scope,
    outOfScope: record.out_of_scope,
    kind: record.kind ?? null,
    riskAreas: record.risk_areas,
    conflicts: record.conflicts,
    confidence: record.confidence,
    sources: record.sources.map((s) => ({ ...s, reason: s.reason ?? null })),
    inputHash,
    headSha: record.head_sha ?? null,
    provider: record.provider ?? null,
    model: record.model ?? null,
    tokensIn: record.tokens_in ?? null,
    tokensOut: record.tokens_out ?? null,
    costUsd: record.cost_usd ?? null,
    generatedAt: record.generated_at ? new Date(record.generated_at) : new Date(),
  };
  await db
    .insert(t.prIntent)
    .values({ prId, ...values })
    .onConflictDoUpdate({ target: t.prIntent.prId, set: values });
}

export async function getIntent(db: Db, prId: string): Promise<StoredIntent | undefined> {
  const [row] = await db.select().from(t.prIntent).where(eq(t.prIntent.prId, prId));
  if (!row) return undefined;
  const confidence = IntentConfidence.safeParse(row.confidence);
  const kind = IntentKind.safeParse(row.kind);
  const sources = IntentSource.array().safeParse(row.sources);
  return {
    inputHash: row.inputHash,
    record: {
      pr_id: row.prId,
      intent: row.intent,
      in_scope: row.inScope,
      out_of_scope: row.outOfScope,
      kind: kind.success ? kind.data : null,
      risk_areas: row.riskAreas,
      conflicts: row.conflicts,
      confidence: confidence.success ? confidence.data : 'low',
      sources: sources.success ? sources.data : [],
      generated_at: row.generatedAt.toISOString(),
      head_sha: row.headSha,
      provider: row.provider,
      model: row.model,
      tokens_in: row.tokensIn,
      tokens_out: row.tokensOut,
      cost_usd: row.costUsd,
    },
  };
}

/** The PR's commit messages, oldest first (an intent source). */
export async function getPrCommitMessages(db: Db, prId: string): Promise<string[]> {
  const rows = await db
    .select({ message: t.prCommits.message })
    .from(t.prCommits)
    .where(eq(t.prCommits.prId, prId))
    .orderBy(asc(t.prCommits.committedAt));
  return rows.map((r) => r.message);
}
