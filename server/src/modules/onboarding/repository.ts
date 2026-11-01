/**
 * Onboarding Tour (L05) — the module's only SQL. It touches `onboarding`
 * (read/write, one row per repo) and `pull_requests` (read), never an index
 * table: the index belongs to the indexer module and is reached through its facade (INV-2).
 *
 * `onboarding` has no `workspace_id`: it is scoped through `repos`, and the
 * route confirms the repo belongs to the caller's workspace before an id gets
 * here. Open PRs are scoped by `workspace_id` as well (AC-65).
 */
import { and, desc, eq, notInArray, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { OpenPull } from './facts/helpers.js';

export class OnboardingRepository {
  constructor(private db: Db) {}

  /** The stored tour envelope (unparsed) and when it was written. */
  async getStored(repoId: string): Promise<{ json: unknown; generatedAt: Date } | undefined> {
    const [row] = await this.db
      .select({ json: t.onboarding.json, generatedAt: t.onboarding.generatedAt })
      .from(t.onboarding)
      .where(eq(t.onboarding.repoId, repoId));
    return row;
  }

  /**
   * Replace the repo's tour (AC-24). `generated_at` is set explicitly: its
   * `defaultNow()` fires on insert only, so an update would keep the old time.
   */
  async upsert(repoId: string, json: unknown, generatedAt: Date): Promise<void> {
    await this.db
      .insert(t.onboarding)
      .values({ repoId, json, generatedAt })
      .onConflictDoUpdate({ target: t.onboarding.repoId, set: { json, generatedAt } });
  }

  /** Open PRs of the repo in this workspace, newest first (D-17). */
  async listOpenPulls(workspaceId: string, repoId: string, limit: number): Promise<OpenPull[]> {
    return this.db
      .select({
        number: t.pullRequests.number,
        title: t.pullRequests.title,
        author: t.pullRequests.author,
        status: t.pullRequests.status,
        updatedAt: t.pullRequests.updatedAt,
      })
      .from(t.pullRequests)
      .where(
        and(
          eq(t.pullRequests.workspaceId, workspaceId),
          eq(t.pullRequests.repoId, repoId),
          notInArray(t.pullRequests.status, ['merged', 'closed']),
        ),
      )
      .orderBy(sql`${t.pullRequests.updatedAt} desc nulls last`, desc(t.pullRequests.number))
      .limit(limit);
  }
}
