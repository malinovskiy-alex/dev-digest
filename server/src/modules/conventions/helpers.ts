import type {
  ConventionCandidate,
  ConventionCategory,
  ConventionScan,
  ConventionStatus,
  Skill,
  SkillSource,
  SkillType,
} from '@devdigest/shared';

/**
 * Pure row ⇄ DTO mapping for the conventions module. Ring 1: no drizzle, no
 * `src/db/`, no adapter — the row shapes are declared STRUCTURALLY so this file
 * needs nothing from the outer rings, and drizzle's inferred rows are
 * assignable to them at the call site.
 *
 * `toSkillDto` is a near-copy of the one in `modules/skills/helpers.ts`, and
 * that is on purpose: a module never imports a sibling module's folder (the
 * `no-cross-module` rule), and the skill this module writes goes out in its own
 * response. Ten lines of duplication is the price of the boundary; the
 * alternative is promoting the mapper to `_shared/`, which would churn a module
 * this feature has no business editing.
 */

/** The persisted `conventions` columns these mappers read. */
export interface ConventionRowShape {
  id: string;
  repoId: string | null;
  category: string;
  rule: string;
  evidencePath: string | null;
  evidenceStartLine: number | null;
  evidenceEndLine: number | null;
  evidenceSnippet: string | null;
  confidence: number | null;
  status: string;
  createdAt: Date;
}

/** The persisted `convention_scans` columns these mappers read. */
export interface ConventionScanRowShape {
  id: string;
  repoId: string;
  sampleCount: number;
  model: string;
  createdAt: Date;
}

/** The persisted `skills` columns `toSkillDto` reads. */
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

/**
 * Map a stored convention to its DTO.
 *
 * The evidence columns are nullable in the schema (the table predates this
 * feature) but never null in a row this module writes — the evidence gate drops
 * a candidate before it can be stored without one. The fallbacks below exist so
 * a row written by something else cannot 500 the screen.
 */
export function toConventionDto(row: ConventionRowShape): ConventionCandidate {
  return {
    id: row.id,
    repo_id: row.repoId ?? '',
    category: row.category as ConventionCategory,
    rule: row.rule,
    evidence_path: row.evidencePath ?? '',
    evidence_start_line: row.evidenceStartLine ?? 0,
    evidence_end_line: row.evidenceEndLine ?? 0,
    evidence_snippet: row.evidenceSnippet ?? '',
    confidence: row.confidence ?? 0,
    status: row.status as ConventionStatus,
    created_at: row.createdAt.toISOString(),
  };
}

export function toScanDto(row: ConventionScanRowShape): ConventionScan {
  return {
    id: row.id,
    repo_id: row.repoId,
    sample_count: row.sampleCount,
    model: row.model,
    created_at: row.createdAt.toISOString(),
  };
}

/** Map the skill this module just wrote to the public `Skill` DTO. */
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
    // Freshly created: nothing can be attached to it yet.
    agent_count: 0,
  };
}
