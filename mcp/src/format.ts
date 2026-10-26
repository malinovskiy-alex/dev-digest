/**
 * Ring 1 — the concise result each tool returns (spec principle 3).
 *
 * Pure and synchronous. The output zod schemas live here because they ARE the
 * result contract: `server.ts` hands them to the SDK as `outputSchema`, and the
 * types the handlers return are inferred from them, so the two cannot drift.
 *
 * Inputs are described structurally (`ReviewLike`, …) instead of importing the
 * port's API types — Ring 1 imports nothing from `api/`.
 */
import { z } from 'zod/v3';
import type { Agent, ConventionCandidate, ConventionScan, Finding, Severity } from '@devdigest/shared';

// ---- limits ---------------------------------------------------------------

/** Cut points (characters) for the free-text fields. */
export const MESSAGE_MAX = 280;
export const SUMMARY_MAX = 500;
export const AGENT_DESCRIPTION_MAX = 160;
export const TITLE_MAX = 120;
export const CATEGORY_MAX = 40;
export const FILE_MAX = 200;
export const AGENT_NAME_MAX = 80;
export const VERDICT_MAX = 40;
export const CONVENTION_RULE_MAX = 280;
export const EVIDENCE_MAX = 200;
export const AGENT_ID_MAX = 80;
export const MODEL_MAX = 80;
export const REPO_MAX = 200;
/** Cap for a run id quoted into a `next` hint or an error message. */
export const RUN_ID_MAX = 80;

export const FINDINGS_LIMIT_DEFAULT = 20;
export const CONVENTIONS_LIMIT_DEFAULT = 30;
/** Upper bound of every `limit` argument. */
export const LIMIT_MAX = 100;

/** Most severe first. A runtime copy — shared is types-only (server/INSIGHTS.md). */
export const SEVERITIES = ['CRITICAL', 'WARNING', 'SUGGESTION'] as const satisfies readonly Severity[];
type _SeveritiesExhaustive = Exclude<Severity, (typeof SEVERITIES)[number]> extends never ? true : never;
const _severitiesExhaustive: _SeveritiesExhaustive = true;
void _severitiesExhaustive;

const SEVERITY_RANK: Record<Severity, number> = { CRITICAL: 0, WARNING: 1, SUGGESTION: 2 };

// ---- output schemas (= tool outputSchema) ---------------------------------

export const SeverityCountsSchema = z.object({
  CRITICAL: z.number().int(),
  WARNING: z.number().int(),
  SUGGESTION: z.number().int(),
});
export type SeverityCountsOut = z.infer<typeof SeverityCountsSchema>;

export const CompactFindingSchema = z.object({
  id: z.string(),
  severity: z.enum(SEVERITIES),
  category: z.string(),
  file: z.string(),
  line: z.number().int(),
  end_line: z.number().int(),
  title: z.string(),
  message: z.string(),
});
export type CompactFinding = z.infer<typeof CompactFindingSchema>;

export const ReviewResultSchema = z.object({
  repo: z.string(),
  pr: z.number().int(),
  run_id: z.string().nullable(),
  agent: z.string().nullable(),
  status: z.enum(['done', 'running']),
  reused_run: z.boolean().optional(),
  verdict: z.string().nullable(),
  score: z.number().nullable(),
  summary: z.string().nullable(),
  counts: SeverityCountsSchema,
  findings: z.array(CompactFindingSchema),
  shown: z.number().int(),
  total: z.number().int(),
  dismissed: z.number().int(),
  next: z.string().optional(),
});
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

export const AgentSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  model: z.string(),
});
export const AgentsResultSchema = z.object({ agents: z.array(AgentSummarySchema) });
export type AgentsResult = z.infer<typeof AgentsResultSchema>;

export const CompactConventionSchema = z.object({
  id: z.string(),
  category: z.string(),
  rule: z.string(),
  evidence: z.string(),
});
export const ConventionsResultSchema = z.object({
  repo: z.string(),
  scanned_at: z.string().nullable(),
  sample_count: z.number().int(),
  total: z.number().int(),
  shown: z.number().int(),
  conventions: z.array(CompactConventionSchema),
  next: z.string().optional(),
});
export type ConventionsResult = z.infer<typeof ConventionsResultSchema>;

/** What every handler returns: the structured result plus its one text block. */
export interface ToolOutput<T> {
  data: T;
  text: string;
}

// ---- inputs (structural) --------------------------------------------------

export type FindingLike = Pick<
  Finding,
  'id' | 'severity' | 'category' | 'title' | 'file' | 'start_line' | 'end_line' | 'rationale'
> & { dismissed_at: string | null };

export interface ReviewLike {
  run_id: string | null;
  agent_id: string | null;
  agent_name?: string | null;
  verdict: string | null;
  summary: string | null;
  score: number | null;
  findings: readonly FindingLike[];
}

export type AgentLike = Pick<Agent, 'id' | 'name' | 'description' | 'enabled' | 'model'>;
export type ConventionLike = Pick<
  ConventionCandidate,
  'id' | 'category' | 'rule' | 'evidence_path' | 'evidence_start_line' | 'evidence_end_line' | 'status'
>;
export interface ConventionsViewLike {
  scan: Pick<ConventionScan, 'sample_count' | 'created_at'> | null;
  candidates: readonly ConventionLike[];
}

// ---- helpers --------------------------------------------------------------

/** Cut `text` to at most `max` characters, marking the cut with an ellipsis. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  if (max <= 1) return text.slice(0, max);
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Collapse every whitespace run (newlines included) to one space. */
export function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * An API-supplied free-text value made safe to interpolate into a text line:
 * one line (so a newline cannot forge a line of ours), then capped. Idempotent.
 */
export function clean(text: string, max: number): string {
  return truncate(oneLine(text), max);
}

function cleanOrNull(text: string | null, max: number): string | null {
  return text === null ? null : clean(text, max);
}

export function emptyCounts(): SeverityCountsOut {
  return { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
}

function countsText(c: SeverityCountsOut): string {
  return SEVERITIES.map((s) => `${c[s]} ${s}`).join(' ');
}

function compareFindings(a: FindingLike, b: FindingLike): number {
  return (
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    a.file.localeCompare(b.file) ||
    a.start_line - b.start_line
  );
}

// ---- reviews --------------------------------------------------------------

export interface CompactReviewOptions {
  repo: string;
  pr: number;
  limit?: number;
  minSeverity?: Severity;
  reusedRun?: boolean;
}

/** A finished review → `ReviewResult` (status `done`). */
export function compactReview(review: ReviewLike, opts: CompactReviewOptions): ReviewResult {
  const limit = clampLimit(opts.limit, FINDINGS_LIMIT_DEFAULT);
  const live = review.findings.filter((f) => f.dismissed_at === null);
  const dismissed = review.findings.length - live.length;

  // Counts are taken before min_severity and limit — the whole picture.
  const counts = emptyCounts();
  for (const f of live) counts[f.severity] += 1;

  const floor = opts.minSeverity ? SEVERITY_RANK[opts.minSeverity] : SEVERITY_RANK.SUGGESTION;
  const eligible = live.filter((f) => SEVERITY_RANK[f.severity] <= floor).sort(compareFindings);
  const findings = eligible.slice(0, limit).map(compactFinding);

  const result: ReviewResult = {
    repo: opts.repo,
    pr: opts.pr,
    run_id: review.run_id,
    agent: cleanOrNull(review.agent_name ?? review.agent_id, AGENT_NAME_MAX),
    status: 'done',
    ...(opts.reusedRun ? { reused_run: true } : {}),
    verdict: cleanOrNull(review.verdict, VERDICT_MAX),
    score: review.score,
    summary: cleanOrNull(review.summary, SUMMARY_MAX),
    counts,
    findings,
    shown: findings.length,
    total: eligible.length,
    dismissed,
  };
  const next = findingsNext(result, limit, review.run_id);
  return next ? { ...result, next } : result;
}

function compactFinding(f: FindingLike): CompactFinding {
  return {
    id: f.id,
    severity: f.severity,
    category: clean(f.category, CATEGORY_MAX),
    file: clean(f.file, FILE_MAX),
    line: f.start_line,
    end_line: f.end_line,
    title: clean(f.title, TITLE_MAX),
    message: clean(f.rationale, MESSAGE_MAX),
  };
}

function findingsNext(r: ReviewResult, limit: number, runId: string | null): string | undefined {
  if (r.shown >= r.total) return undefined;
  const runArg = runId ? ` run_id="${clean(runId, RUN_ID_MAX)}"` : '';
  const more = r.total - r.shown;
  if (limit < LIMIT_MAX) {
    return `${more} more finding(s) not shown — call get_findings with${runArg} limit=${Math.min(r.total, LIMIT_MAX)}, or narrow with min_severity.`;
  }
  return `${more} more finding(s) not shown — narrow with min_severity, or open the PR in the DevDigest UI.`;
}

/** A run that has not finished yet → `ReviewResult` (status `running`). */
export function runningResult(opts: {
  repo: string;
  pr: number;
  runId: string;
  agent: string | null;
  reusedRun?: boolean;
  next: string;
}): ReviewResult {
  return {
    repo: opts.repo,
    pr: opts.pr,
    run_id: opts.runId,
    agent: cleanOrNull(opts.agent, AGENT_NAME_MAX),
    status: 'running',
    ...(opts.reusedRun ? { reused_run: true } : {}),
    verdict: null,
    score: null,
    summary: null,
    counts: emptyCounts(),
    findings: [],
    shown: 0,
    total: 0,
    dismissed: 0,
    next: opts.next,
  };
}

/** The text block: a header line, one line per finding, then `next`. */
export function renderReviewText(r: ReviewResult): string {
  // Values are cleaned again here (idempotent) so the text block holds even
  // for a ReviewResult that did not come through compactReview/runningResult.
  const agent = r.agent === null ? 'unknown agent' : clean(r.agent, AGENT_NAME_MAX);
  const head = `${clean(r.repo, REPO_MAX)}#${r.pr} · ${agent}`;
  if (r.status === 'running') {
    return [`${head} · running · run ${r.run_id === null ? '?' : clean(r.run_id, RUN_ID_MAX)}`, r.next].filter(Boolean).join('\n');
  }
  const score = r.score === null ? 'no score' : `score ${r.score}`;
  const verdict = r.verdict === null ? 'no verdict' : clean(r.verdict, VERDICT_MAX);
  const lines = [`${head} · ${verdict} · ${score} · ${countsText(r.counts)}`];
  for (const f of r.findings) {
    lines.push(
      `${f.severity} ${clean(f.category, CATEGORY_MAX)} ${clean(f.file, FILE_MAX)}:${f.line} — ${clean(f.title, TITLE_MAX)}: ${clean(f.message, MESSAGE_MAX)}`,
    );
  }
  if (r.next) lines.push(r.next);
  return lines.join('\n');
}

// ---- agents ---------------------------------------------------------------

export function compactAgents(agents: readonly AgentLike[]): AgentsResult {
  return {
    agents: agents.map((a) => ({
      id: clean(a.id, AGENT_ID_MAX),
      name: clean(a.name, AGENT_NAME_MAX),
      description: clean(a.description ?? '', AGENT_DESCRIPTION_MAX),
      enabled: a.enabled,
      model: clean(a.model, MODEL_MAX),
    })),
  };
}

export function renderAgentsText(r: AgentsResult): string {
  if (r.agents.length === 0) return 'No reviewer agents configured — create one in the DevDigest UI (Agents).';
  return r.agents
    .map((a) => {
      const state = a.enabled ? 'enabled' : 'disabled';
      const desc = a.description ? ` — ${clean(a.description, AGENT_DESCRIPTION_MAX)}` : '';
      return `${clean(a.name, AGENT_NAME_MAX)} (${clean(a.id, AGENT_ID_MAX)}) · ${clean(a.model, MODEL_MAX)} · ${state}${desc}`;
    })
    .join('\n');
}

// ---- conventions ----------------------------------------------------------

export function compactConventions(
  view: ConventionsViewLike,
  opts: { repo: string; limit?: number },
): ConventionsResult {
  if (view.scan === null) {
    return {
      repo: opts.repo,
      scanned_at: null,
      sample_count: 0,
      total: 0,
      shown: 0,
      conventions: [],
      next: `${clean(opts.repo, REPO_MAX)} has not been scanned for conventions yet — run the extractor on the repo's Conventions screen in the DevDigest UI.`,
    };
  }
  const limit = clampLimit(opts.limit, CONVENTIONS_LIMIT_DEFAULT);
  const accepted = view.candidates.filter((c) => c.status === 'accepted');
  const conventions = accepted.slice(0, limit).map((c) => ({
    id: c.id,
    category: clean(c.category, CATEGORY_MAX),
    rule: clean(c.rule, CONVENTION_RULE_MAX),
    evidence: clean(`${c.evidence_path}:${c.evidence_start_line}-${c.evidence_end_line}`, EVIDENCE_MAX),
  }));
  const result: ConventionsResult = {
    repo: opts.repo,
    scanned_at: view.scan.created_at,
    sample_count: view.scan.sample_count,
    total: accepted.length,
    shown: conventions.length,
    conventions,
  };
  if (conventions.length < accepted.length) {
    const more = accepted.length - conventions.length;
    const next =
      limit < LIMIT_MAX
        ? `${more} more convention(s) not shown — call get_conventions with limit=${Math.min(accepted.length, LIMIT_MAX)}.`
        : `${more} more convention(s) not shown — see the repo's Conventions screen in the DevDigest UI.`;
    return { ...result, next };
  }
  return result;
}

export function renderConventionsText(r: ConventionsResult): string {
  const head =
    r.scanned_at === null
      ? `${clean(r.repo, REPO_MAX)} · no conventions scan`
      : `${clean(r.repo, REPO_MAX)} · ${r.total} accepted convention(s) · from ${r.sample_count} sample files`;
  const lines = [head, ...r.conventions.map(
      (c) =>
        `[${clean(c.category, CATEGORY_MAX)}] ${clean(c.rule, CONVENTION_RULE_MAX)} (${clean(c.evidence, EVIDENCE_MAX)})`,
    ),];
  if (r.next) lines.push(r.next);
  return lines.join('\n');
}

// ---- shared ---------------------------------------------------------------

/** Apply the default and the 1..LIMIT_MAX bound (the input schema also enforces it). */
export function clampLimit(limit: number | undefined, fallback: number): number {
  if (limit === undefined || !Number.isFinite(limit)) return fallback;
  return Math.min(LIMIT_MAX, Math.max(1, Math.trunc(limit)));
}
