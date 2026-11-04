/**
 * PR Brief (L05) — the module's only SQL. It touches `pr_brief` alone: one
 * row per PR, keyed by `pr_id`, the whole brief in `json` (D-5 — no migration,
 * the head SHA lives in `json.meta`).
 *
 * `pr_brief` has no `workspace_id`: it is scoped through `pull_requests`, and
 * the service resolves the PR with the workspace-scoped `getPull` before an
 * id ever gets here (R-18).
 */
import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

export class BriefRepository {
  constructor(private db: Db) {}

  /** The stored json (unparsed), or undefined when the PR has no brief. */
  async get(prId: string): Promise<unknown | undefined> {
    const [row] = await this.db.select({ json: t.prBrief.json }).from(t.prBrief).where(eq(t.prBrief.prId, prId));
    return row?.json;
  }

  /** Replace the PR's brief (R-16) — one statement, keyed on the primary key. */
  async upsert(prId: string, json: unknown): Promise<void> {
    await this.db
      .insert(t.prBrief)
      .values({ prId, json })
      .onConflictDoUpdate({ target: t.prBrief.prId, set: { json } });
  }
}
