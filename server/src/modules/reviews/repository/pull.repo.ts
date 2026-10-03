import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../../../db/client.js';
import * as t from '../../../db/schema.js';
import { IntentConfidence, IntentKind, IntentSource } from '@devdigest/shared';
import type { PrIntentRecord } from '@devdigest/shared';
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
