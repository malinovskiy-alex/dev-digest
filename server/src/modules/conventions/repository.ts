import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { ConventionCategory, ConventionStatus } from '@devdigest/shared';
import type { ConventionRow, ConventionScanRow } from '../../db/rows.js';

export type { ConventionRow, ConventionScanRow };

/**
 * A7 — conventions data access. Owns `conventions` and `convention_scans`.
 * Workspace-scoped throughout; the repo id is checked one level up
 * (`requireRepoInWorkspace`) before anything here is called.
 */

export interface InsertConvention {
  category: ConventionCategory;
  rule: string;
  evidencePath: string;
  evidenceStartLine: number;
  evidenceEndLine: number;
  evidenceSnippet: string;
  confidence: number;
}

export interface UpdateConvention {
  status?: ConventionStatus;
  rule?: string;
  category?: ConventionCategory;
}

export class ConventionsRepository {
  constructor(private db: Db) {}

  /** The repo's most recent scan, or `undefined` when it was never scanned. */
  async latestScan(workspaceId: string, repoId: string): Promise<ConventionScanRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.conventionScans)
      .where(
        and(eq(t.conventionScans.workspaceId, workspaceId), eq(t.conventionScans.repoId, repoId)),
      )
      .orderBy(desc(t.conventionScans.createdAt))
      .limit(1);
    return row;
  }

  /**
   * The repo's candidates, most confident first — the order the screen renders
   * and the order the skill draft follows, so the body reads the way the cards
   * did. Rejected rows come back too: the screen shows them struck through
   * rather than making a rejection disappear.
   */
  async listForRepo(workspaceId: string, repoId: string): Promise<ConventionRow[]> {
    return this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)))
      .orderBy(desc(t.conventions.confidence), desc(t.conventions.createdAt));
  }

  async getById(workspaceId: string, id: string): Promise<ConventionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)));
    return row;
  }

  /**
   * Replace the repo's conventions with a fresh scan, in ONE transaction.
   *
   * Deleting the previous scans cascades their candidates (`conventions.scan_id`
   * is `ON DELETE cascade`), which is the whole reason the scan row exists. The
   * transaction matters because the delete happens first: a failure halfway
   * through would otherwise leave the screen empty with no way back — the
   * previous scan is already gone and the new one never landed.
   */
  async replaceScan(
    workspaceId: string,
    repoId: string,
    scan: { sampleCount: number; model: string },
    candidates: InsertConvention[],
  ): Promise<{ scan: ConventionScanRow; rows: ConventionRow[] }> {
    return this.db.transaction(async (tx) => {
      await tx
        .delete(t.conventionScans)
        .where(
          and(eq(t.conventionScans.workspaceId, workspaceId), eq(t.conventionScans.repoId, repoId)),
        );
      // Rows from before this feature had a scan to hang off; `scan_id` is
      // nullable, so they survive the cascade. Clear them explicitly or the
      // screen would mix two scans.
      await tx
        .delete(t.conventions)
        .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)));

      const [scanRow] = await tx
        .insert(t.conventionScans)
        .values({ workspaceId, repoId, sampleCount: scan.sampleCount, model: scan.model })
        .returning();

      if (candidates.length === 0) return { scan: scanRow!, rows: [] };

      const rows = await tx
        .insert(t.conventions)
        .values(
          candidates.map((c) => ({
            workspaceId,
            repoId,
            scanId: scanRow!.id,
            category: c.category,
            rule: c.rule,
            evidencePath: c.evidencePath,
            evidenceStartLine: c.evidenceStartLine,
            evidenceEndLine: c.evidenceEndLine,
            evidenceSnippet: c.evidenceSnippet,
            confidence: c.confidence,
          })),
        )
        .returning();

      return { scan: scanRow!, rows };
    });
  }

  /** Accept / reject, or correct the rule text. `undefined` = not in this workspace. */
  async update(
    workspaceId: string,
    id: string,
    patch: UpdateConvention,
  ): Promise<ConventionRow | undefined> {
    const [row] = await this.db
      .update(t.conventions)
      .set({
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.rule !== undefined ? { rule: patch.rule } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
      })
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)))
      .returning();
    return row;
  }
}
