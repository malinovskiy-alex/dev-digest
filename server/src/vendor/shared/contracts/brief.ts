import { z } from 'zod';

/**
 * PR Brief building blocks: Intent, Blast radius, Risks, PR History,
 * Smart Diff. Composed into PrBrief.
 */

// ---- Intent ----

/** What kind of change the PR is, as classified by the intent model. */
export const IntentKind = z.enum([
  'feature',
  'bugfix',
  'refactor',
  'perf',
  'security',
  'docs',
  'chore',
  'test',
]);
export type IntentKind = z.infer<typeof IntentKind>;

/**
 * How much the derived intent can be trusted. Computed deterministically from
 * WHICH sources were really available (never the model's self-assessment):
 * the model may only lower it.
 */
export const IntentConfidence = z.enum(['high', 'medium', 'low']);
export type IntentConfidence = z.infer<typeof IntentConfidence>;

/** One input the intent was (or failed to be) derived from. Paths/refs only, never content. */
export const IntentSource = z.object({
  type: z.enum(['title', 'description', 'ticket', 'spec', 'branch', 'commits', 'files', 'hunks']),
  /** e.g. `#12`, `specs/intent-layer.md`, `ABC-123`, `feat/rate-limit`. */
  ref: z.string(),
  /** used = in the prompt; failed = found but could not be read; unresolved = not fetchable by design. */
  status: z.enum(['used', 'failed', 'unresolved']),
  /** Why a source is not `used`: not_found, too_large, outside_repo, external, … */
  reason: z.string().nullish(),
});
export type IntentSource = z.infer<typeof IntentSource>;

export const Intent = z.object({
  intent: z.string(),
  in_scope: z.array(z.string()),
  out_of_scope: z.array(z.string()),
  // L03 — the fields below default so a bare { intent, in_scope, out_of_scope }
  // (the pre-L03 shape) still parses.
  kind: IntentKind.nullish(),
  risk_areas: z.array(z.string()).default([]),
  /** Where a resolved spec contradicts the PR description (the spec wins). */
  conflicts: z.array(z.string()).default([]),
  confidence: IntentConfidence.default('low'),
  sources: z.array(IntentSource).default([]),
  /** ISO timestamp of the derive; null for a pre-L03 row. */
  generated_at: z.string().nullish(),
});
export type Intent = z.infer<typeof Intent>;

// ---- Blast radius ----
export const ChangedSymbol = z.object({
  name: z.string(),
  file: z.string(),
  kind: z.string(),
});
export type ChangedSymbol = z.infer<typeof ChangedSymbol>;

export const BlastCaller = z.object({
  name: z.string(),
  file: z.string(),
  line: z.number().int(),
  /** Endpoints / crons declared in this caller's file (index facts). Graph edges. */
  endpoints: z.array(z.string()).default([]),
  crons: z.array(z.string()).default([]),
});
export type BlastCaller = z.infer<typeof BlastCaller>;

export const DownstreamImpact = z.object({
  symbol: z.string(),
  callers: z.array(BlastCaller),
  endpoints_affected: z.array(z.string()),
  crons_affected: z.array(z.string()),
});
export type DownstreamImpact = z.infer<typeof DownstreamImpact>;

/** Why repo-intel served a degraded map. Mirrors repo-intel's DegradedReason. */
export const BlastDegradedReason = z.enum([
  'flag_off',
  'index_failed',
  'index_partial',
  'repo_too_large',
  'no_data',
]);
export type BlastDegradedReason = z.infer<typeof BlastDegradedReason>;

/** repo_index_state.status of the PR's repo at read time. */
export const BlastIndexStatus = z.enum(['full', 'partial', 'degraded', 'failed']);
export type BlastIndexStatus = z.infer<typeof BlastIndexStatus>;

/** The numbers in the summary row, counted from `downstream` (+ changed_symbols). */
export const BlastCounts = z.object({
  symbols: z.number().int().nonnegative(),
  callers: z.number().int().nonnegative(),
  endpoints: z.number().int().nonnegative(),
  crons: z.number().int().nonnegative(),
});
export type BlastCounts = z.infer<typeof BlastCounts>;

export const BlastRadius = z.object({
  changed_symbols: z.array(ChangedSymbol),
  downstream: z.array(DownstreamImpact),
  summary: z.string(),
  // L04 — the fields below default so the bare { changed_symbols, downstream,
  // summary } shape still parses.
  counts: BlastCounts.default({ symbols: 0, callers: 0, endpoints: 0, crons: 0 }),
  /** Passed through verbatim from the facade. */
  degraded: z.boolean().default(false),
  reason: BlastDegradedReason.nullable().default(null),
  /** From getIndexState; lets the UI flag a partial/failed index the facade served as non-degraded. */
  index_status: BlastIndexStatus.nullable().default(null),
  /** Commit the index was built from; caller line links point here. null when never indexed. */
  indexed_sha: z.string().nullable().default(null),
});
export type BlastRadius = z.infer<typeof BlastRadius>;

// ---- Risks ----
export const RiskSeverity = z.enum(['high', 'medium', 'low']);
export type RiskSeverity = z.infer<typeof RiskSeverity>;

export const Risk = z.object({
  kind: z.string(),
  title: z.string(),
  explanation: z.string(),
  severity: RiskSeverity,
  file_refs: z.array(z.string()),
});
export type Risk = z.infer<typeof Risk>;

export const Risks = z.object({
  risks: z.array(Risk),
});
export type Risks = z.infer<typeof Risks>;

// ---- PR History ----
export const PrHistoryItem = z.object({
  pr_number: z.number().int(),
  title: z.string(),
  /**
   * ISO timestamp. For PRs DevDigest synced from GitHub this is the merged PR's
   * last-update time — no merge timestamp is stored (pull_requests has none).
   */
  merged_at: z.string(),
  author: z.string(),
  files_overlap: z.array(z.string()),
  notes: z.string(),
});
export type PrHistoryItem = z.infer<typeof PrHistoryItem>;

export const PrHistory = z.object({
  history: z.array(PrHistoryItem),
  /** How many merged PRs DevDigest knows for this repo were compared. */
  candidates: z.number().int().nonnegative().default(0),
  /** Candidates whose files could not be read this time (budget or GitHub down). */
  unchecked: z.number().int().nonnegative().default(0),
  /** True when GitHub could not be reached for an uncached candidate. */
  github_unavailable: z.boolean().default(false),
});
export type PrHistory = z.infer<typeof PrHistory>;

// ---- Smart Diff ----
// Display order = enum order: core → tests → wiring → docs → boilerplate.
export const SmartDiffRole = z.enum(['core', 'tests', 'wiring', 'docs', 'boilerplate']);
export type SmartDiffRole = z.infer<typeof SmartDiffRole>;

export const SmartDiffFile = z.object({
  path: z.string(),
  pseudocode_summary: z.string().nullish(),
  additions: z.number().int(),
  deletions: z.number().int(),
  finding_lines: z.array(z.number().int()),
});
export type SmartDiffFile = z.infer<typeof SmartDiffFile>;

export const SmartDiffGroup = z.object({
  role: SmartDiffRole,
  files: z.array(SmartDiffFile),
});
export type SmartDiffGroup = z.infer<typeof SmartDiffGroup>;

export const ProposedSplit = z.object({
  name: z.string(),
  files: z.array(z.string()),
});
export type ProposedSplit = z.infer<typeof ProposedSplit>;

export const SmartDiff = z.object({
  // The review `finding_lines` were taken from — the PR's latest `kind='review'`
  // review, chosen by the server. null when the PR has no such review. The
  // client renders inline findings from exactly this review, never its own pick.
  review_id: z.string().nullable(),
  groups: z.array(SmartDiffGroup),
  split_suggestion: z.object({
    too_big: z.boolean(),
    total_lines: z.number().int(),
    proposed_splits: z.array(ProposedSplit),
  }),
});
export type SmartDiff = z.infer<typeof SmartDiff>;

// ---- Composed PR Brief (pr_brief.json) ----
export const PrBrief = z.object({
  intent: Intent,
  blast: BlastRadius,
  risks: Risks,
  history: PrHistory,
});
export type PrBrief = z.infer<typeof PrBrief>;
