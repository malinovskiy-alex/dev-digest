import { z } from 'zod';

/**
 * Conformance, Onboarding, Eval, Memory, Conventions, Skills,
 * Agents and their DTOs.
 */

// ---- Conformance ----
export const ConformanceStatus = z.enum(['implemented', 'missing', 'out_of_scope']);
export type ConformanceStatus = z.infer<typeof ConformanceStatus>;

export const ConformanceItem = z.object({
  requirement: z.string(),
  status: ConformanceStatus,
  evidence_file: z.string().nullish(),
  notes: z.string().nullish(),
});
export type ConformanceItem = z.infer<typeof ConformanceItem>;

export const Conformance = z.object({
  spec_id: z.string(),
  spec_title: z.string(),
  items: z.array(ConformanceItem),
  completeness_pct: z.number().min(0).max(100),
});
export type Conformance = z.infer<typeof Conformance>;

// ---- Onboarding ----
// The repository tour (L05 Onboarding Generator). Deterministic facts first;
// model text only where a field says so. Every section key is always present —
// a skeleton fills it from facts and says what is missing through `gap`.
export const TourComponentKind = z.enum(['ui', 'api', 'service', 'worker', 'data', 'external', 'library']);
export type TourComponentKind = z.infer<typeof TourComponentKind>;
export const TourComponent = z.object({ id: z.string(), label: z.string(), kind: TourComponentKind });
export type TourComponent = z.infer<typeof TourComponent>;
export const TourConnection = z.object({ from: z.string(), to: z.string() });
export type TourConnection = z.infer<typeof TourConnection>;

export const TourSectionGap = z.enum([
  'needs_clone',    // AC-58 "Needs a clone and an index"
  'needs_index',    // AC-15 index not ready (architecture folders)
  'not_ranked',     // AC-51
  'no_edges',       // AC-38
  'no_manifest',    // AC-45
  'no_candidates',  // AC-59
]);
export type TourSectionGap = z.infer<typeof TourSectionGap>;

export const TourStack = z.object({
  languages: z.array(z.object({ name: z.string(), files: z.number().int() })), // by indexed file count desc
  frameworks: z.array(z.string()),
  runtime: z.array(z.string()),
});
export type TourStack = z.infer<typeof TourStack>;
export const TourFolder = z.object({ path: z.string(), files: z.number().int() });
export type TourFolder = z.infer<typeof TourFolder>;

export const TourArchitecture = z.object({
  // `prose` is UNTRUSTED model output. The server scrub (D-26) is best effort
  // only: render it with `<UntrustedMarkdown inertLinks>` so no href in it is
  // ever followable (F-29, F-36). Never render it with a markdown component
  // that turns links into anchors.
  prose: z.string().nullable(),          // model markdown (scrubbed, D-26); null in a skeleton
  components: z.array(TourComponent),     // grounded (AC-33); [] in a skeleton
  connections: z.array(TourConnection),
  stack: TourStack,                       // AC-34
  folders: z.array(TourFolder),           // AC-34, ≤ 30
  gap: TourSectionGap.nullable(),
});
export type TourArchitecture = z.infer<typeof TourArchitecture>;

export const TourFileRow = z.object({
  path: z.string(),
  reason: z.string().nullable(),          // model's one line, or null → client words the deterministic reason
  importers: z.number().int(),            // D-14
  top_percent: z.number().int(),          // D-14
});
export type TourFileRow = z.infer<typeof TourFileRow>;
export const TourFileList = z.object({ rows: z.array(TourFileRow), gap: TourSectionGap.nullable() });
export type TourFileList = z.infer<typeof TourFileList>;

export const TourCommand = z.object({ step: z.number().int(), command: z.string(), comment: z.string().nullable() });
export type TourCommand = z.infer<typeof TourCommand>;
export const TourCommands = z.object({ commands: z.array(TourCommand), gap: TourSectionGap.nullable() });
export type TourCommands = z.infer<typeof TourCommands>;

export const TourTaskKind = z.enum(['todo', 'missing-tests', 'open-pr']);
export type TourTaskKind = z.infer<typeof TourTaskKind>;
export const TourTask = z.object({
  candidate_id: z.string(),
  kind: TourTaskKind,
  source: z.enum(['model', 'fallback']),
  title: z.string().nullable(),           // model title; null for fallback (client words it, D-19)
  reason: z.string().nullable(),          // model reason; null for fallback
  path: z.string().nullable(),
  line: z.number().int().nullable(),
  pr_number: z.number().int().nullable(),
  pr_title: z.string().nullable(),
  detail: z.string().nullable(),          // TODO text | PR author — deterministic context
  importers: z.number().int().nullable(),
  top_percent: z.number().int().nullable(),
});
export type TourTask = z.infer<typeof TourTask>;
export const TourTasks = z.object({ tasks: z.array(TourTask), gap: TourSectionGap.nullable() });
export type TourTasks = z.infer<typeof TourTasks>;

export const TourSections = z.object({
  architecture: TourArchitecture,
  critical_paths: TourFileList,
  run_locally: TourCommands,
  reading_path: TourFileList,
  first_tasks: TourTasks,
});
export type TourSections = z.infer<typeof TourSections>;

export const TourStatus = z.enum(['generated', 'ready', 'not_cloned', 'index_not_ready']); // which sections are shown; blockers say why Generate is off
export type TourStatus = z.infer<typeof TourStatus>;
export const TourFailureCode = z.enum(['no_api_key', 'timeout', 'provider_error', 'invalid_output', 'source_unreadable']); // source_unreadable: git could not read the revision, nothing was generated (F-52)
export type TourFailureCode = z.infer<typeof TourFailureCode>;
export const TourGeneration = z.object({
  running: z.boolean(),
  failure: z
    .object({ code: TourFailureCode, message: z.string(), provider: z.string().nullable(), at: z.string() })
    .nullable(),
});
export type TourGeneration = z.infer<typeof TourGeneration>;

export const TourMeta = z.object({
  revision: z.string(),
  generated_at: z.string(),
  index_files: z.number().int(),          // AC-12 N
  source_files: z.number().int().nullable(), // AC-13 M
  coverage_partial: z.boolean(),          // AC-13
  index_partial: z.boolean(),             // AC-16
  trimmed: z.boolean(),                   // AC-69
  provider: z.string(),                   // AC-84
  model: z.string(),
  cost_usd: z.number().nullable(),
  outdated: z.boolean(),                  // AC-74
});
export type TourMeta = z.infer<typeof TourMeta>;

// Why generation is not possible right now, in display order (D-41). Several may apply.
export const TourBlocker = z.enum(['not_cloned', 'index_not_ready', 'no_api_key']);
export type TourBlocker = z.infer<typeof TourBlocker>;
export const TourApiKey = z.object({ provider: z.string(), model: z.string(), missing: z.boolean() }); // AC-86
export type TourApiKey = z.infer<typeof TourApiKey>;

export const OnboardingTour = z.object({
  repo_id: z.string(),
  full_name: z.string(),                  // owner/name — breadcrumb (AC-06)
  name: z.string(),                       // heading accent (AC-06)
  default_branch: z.string(),
  status: TourStatus,                     // 'generated' whenever a valid stored tour exists (D-45)
  index_reason: z.string().nullable(),    // AC-15, AC-51 (D-24)
  revision: z.string().nullable(),        // sha that GitHub links point at; null without a clone
  blockers: z.array(TourBlocker),         // AC-14, AC-15, AC-86 — ordered not_cloned, index_not_ready, no_api_key
  api_key: TourApiKey,                    // AC-86 — checked on GET, no model call (D-42)
  can_generate: z.boolean(),              // blockers.length === 0 && !generation.running
  generation: TourGeneration,
  meta: TourMeta.nullable(),              // non-null iff status === 'generated'
  sections: TourSections,
});
export type OnboardingTour = z.infer<typeof OnboardingTour>;

export const TourGenerateAccepted = z.object({ running: z.literal(true) });
export type TourGenerateAccepted = z.infer<typeof TourGenerateAccepted>;

// ---- Eval ----
export const EvalPerTrace = z.object({
  name: z.string(),
  pass: z.boolean(),
  expected: z.unknown(),
  actual: z.unknown(),
});
export type EvalPerTrace = z.infer<typeof EvalPerTrace>;

export const EvalRun = z.object({
  recall: z.number().min(0).max(1),
  precision: z.number().min(0).max(1),
  citation_accuracy: z.number().min(0).max(1),
  traces_passed: z.number().int(),
  traces_total: z.number().int(),
  duration_ms: z.number().int(),
  cost_usd: z.number().nullable(),
  per_trace: z.array(EvalPerTrace),
});
export type EvalRun = z.infer<typeof EvalRun>;

export const EvalOwnerKind = z.enum(['skill', 'agent']);
export type EvalOwnerKind = z.infer<typeof EvalOwnerKind>;

export const EvalCase = z.object({
  id: z.string(),
  owner_kind: EvalOwnerKind,
  owner_id: z.string(),
  name: z.string(),
  input_diff: z.string(),
  input_files: z.unknown(),
  input_meta: z.unknown(),
  expected_output: z.unknown(),
  notes: z.string().nullish(),
});
export type EvalCase = z.infer<typeof EvalCase>;

// ---- Memory ----
export const MemoryScope = z.enum(['repo', 'global', 'team']);
export type MemoryScope = z.infer<typeof MemoryScope>;

export const MemoryKind = z.enum([
  'decision',
  'convention',
  'preference',
  'fact',
  'learning',
]);
export type MemoryKind = z.infer<typeof MemoryKind>;

export const MemorySource = z.object({
  pr: z.number().int().nullish(),
  context: z.string(),
});
export type MemorySource = z.infer<typeof MemorySource>;

export const MemoryItem = z.object({
  content: z.string(),
  scope: MemoryScope,
  kind: MemoryKind,
  confidence: z.number().min(0).max(1),
  sources: z.array(MemorySource),
});
export type MemoryItem = z.infer<typeof MemoryItem>;

// ---- Skills ----
export const SkillType = z.enum(['rubric', 'convention', 'security', 'custom']);
export type SkillType = z.infer<typeof SkillType>;

// 'imported_file' = came from a markdown file or a .zip the user uploaded. Such
// a skill is stored DISABLED until the user vets and enables it: an enabled
// skill is INSTRUCTIONS in the agent's prompt, not delimiter-wrapped data.
// See specs/L02-skills-in-the-product.md D6.
export const SkillSource = z.enum([
  'manual',
  'imported_file',
  'imported_url',
  'extracted',
  'community',
]);
export type SkillSource = z.infer<typeof SkillSource>;

export const Skill = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: SkillType,
  source: SkillSource,
  body: z.string(),
  enabled: z.boolean(),
  version: z.number().int(),
  evidence_files: z.array(z.string()).nullish(),
  /**
   * How many agents actually send this skill — the reuse signal on the card and
   * the weight behind a delete. Counts only rows an agent has checked while the
   * skill is enabled globally, so it answers "who loses something if this goes
   * away". Read-only: derived from `agent_skills`, never written through the
   * skills endpoints.
   *
   * Required on purpose — see `Agent.skill_count` for why a default would be
   * worse than a missing field here.
   */
  agent_count: z.number().int(),
});
export type Skill = z.infer<typeof Skill>;

/** One immutable body revision of a skill. Mirrors the `skill_versions` table. */
export const SkillVersion = z.object({
  skill_id: z.string(),
  version: z.number().int(),
  body: z.string(),
  created_at: z.string(),
});
export type SkillVersion = z.infer<typeof SkillVersion>;

/**
 * How one entry of an uploaded archive was classified. ONLY `core` is ever
 * decompressed — an `executable` entry contributes its central-directory name
 * and size to the preview and nothing else. See L02 6.5.
 */
export const SkillImportEntryKind = z.enum(['core', 'doc', 'executable', 'other']);
export type SkillImportEntryKind = z.infer<typeof SkillImportEntryKind>;

export const SkillImportEntry = z.object({
  path: z.string(),
  bytes: z.number().int(),
  kind: SkillImportEntryKind,
  /** true for everything except `core`: named in the listing, never parsed. */
  ignored: z.boolean(),
});
export type SkillImportEntry = z.infer<typeof SkillImportEntry>;

/**
 * The result of parsing an upload. NOTHING is persisted to produce this — the
 * user sees the extracted body and the ignored-entry listing first, and only a
 * confirm writes a row. `token` is the sha256 of the extracted core body; the
 * confirm call re-parses and compares it, so a body that changed between the
 * two calls is a 409 instead of a silent swap.
 */
export const SkillImportPreview = z.object({
  token: z.string(),
  name: z.string(),
  description: z.string(),
  type: SkillType,
  body: z.string(),
  source: SkillSource,
  entries: z.array(SkillImportEntry),
  warnings: z.array(z.string()),
});
export type SkillImportPreview = z.infer<typeof SkillImportPreview>;

export const CommunitySkill = z.object({
  name: z.string(),
  repo: z.string(),
  stars: z.number().int(),
  lang: z.string(),
  desc: z.string(),
});
export type CommunitySkill = z.infer<typeof CommunitySkill>;

// ---- Conventions ----
/**
 * What kind of house-rule a candidate is. Broad on purpose: the value is a
 * grouping label on the card, not a routing key — nothing branches on it.
 */
export const ConventionCategory = z.enum([
  'naming',
  'structure',
  'error-handling',
  'async',
  'typing',
  'testing',
  'imports',
  'api',
  'docs',
  'other',
]);
export type ConventionCategory = z.infer<typeof ConventionCategory>;

/**
 * Two states, and a fresh candidate is `accepted`. The reader's job on this
 * screen is to throw out what is wrong, not to re-click what is right — see
 * specs/L02-conventions-extractor.md D3.
 */
export const ConventionStatus = z.enum(['accepted', 'rejected']);
export type ConventionStatus = z.infer<typeof ConventionStatus>;

/**
 * One extracted house-rule, already verified against the clone: the path was
 * one of the sampled files, the line range exists, and `evidence_snippet` was
 * re-read FROM THAT FILE rather than taken from the model. An unverifiable
 * candidate is dropped before it is stored, so every row here is grounded.
 */
export const ConventionCandidate = z.object({
  id: z.string(),
  repo_id: z.string(),
  category: ConventionCategory,
  rule: z.string(),
  evidence_path: z.string(),
  evidence_start_line: z.number().int(),
  evidence_end_line: z.number().int(),
  evidence_snippet: z.string(),
  confidence: z.number().min(0).max(1),
  status: ConventionStatus,
  created_at: z.string(),
});
export type ConventionCandidate = z.infer<typeof ConventionCandidate>;

/**
 * One run of the extractor. `sample_count` is how many files were actually
 * read (configs + top-ranked sources), which is what the screen's "Detected
 * from N sample files" line reports. A re-scan replaces the previous scan and
 * its candidates cascade with it.
 */
export const ConventionScan = z.object({
  id: z.string(),
  repo_id: z.string(),
  sample_count: z.number().int(),
  model: z.string(),
  created_at: z.string(),
});
export type ConventionScan = z.infer<typeof ConventionScan>;

/** The whole screen in one response. `scan: null` = this repo was never scanned. */
export const ConventionsView = z.object({
  scan: ConventionScan.nullable(),
  candidates: z.array(ConventionCandidate),
});
export type ConventionsView = z.infer<typeof ConventionsView>;

/**
 * The skill a scan would produce, composed by CODE from the accepted
 * candidates. The model never writes a skill body: it proposes rules, and this
 * is the deterministic rendering of the ones a human kept. The create-skill
 * modal is a full editor over these fields, and what it submits is what is
 * stored.
 */
export const ConventionSkillDraft = z.object({
  name: z.string(),
  description: z.string(),
  type: SkillType,
  body: z.string(),
  convention_ids: z.array(z.string()),
  evidence_files: z.array(z.string()),
});
export type ConventionSkillDraft = z.infer<typeof ConventionSkillDraft>;

// ---- Agents ----
// 'openrouter' routes through the OpenAI-compatible API (OpenAIProvider with a
// custom baseURL) — used by the CI runner for cheap models (DeepSeek/GLM/MiniMax).
export const Provider = z.enum(['openai', 'anthropic', 'openrouter']);
export type Provider = z.infer<typeof Provider>;

// Review execution strategy (matches @devdigest/reviewer-core's ReviewStrategy):
//  - single-pass: send the WHOLE diff in ONE model call (default)
//  - map-reduce:  one model call PER changed file (for very large diffs)
//  - auto:        single-pass, switching to map-reduce when the diff is large
export const ReviewStrategy = z.enum(['single-pass', 'map-reduce', 'auto']);
export type ReviewStrategy = z.infer<typeof ReviewStrategy>;

// CI gate policy — when a review should BLOCK (REQUEST_CHANGES + fail the check)
// vs just comment. Deterministic from finding severities, NOT the model's verdict:
//  - never:    never block, always comment (advisory only)
//  - critical: block iff >=1 CRITICAL finding (default)
//  - warning:  block iff >=1 WARNING or CRITICAL finding
//  - any:      block iff >=1 finding of any severity
export const CiFailOn = z.enum(['never', 'critical', 'warning', 'any']);
export type CiFailOn = z.infer<typeof CiFailOn>;

export const Agent = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  provider: Provider,
  model: z.string(),
  system_prompt: z.string(),
  output_schema: z.unknown().nullish(),
  enabled: z.boolean(),
  version: z.number().int(),
  strategy: ReviewStrategy.default('single-pass'),
  ci_fail_on: CiFailOn.default('critical'),
  // Inject repo-intel context (repo skeleton + callers + rank note) into this
  // agent's review prompt. Default on; gated again by the global flag.
  repo_intel: z.boolean().default(true),
  /**
   * How many skills this agent actually sends — the rows of its Skills tab
   * that are checked AND whose skill is enabled globally. Read-only: derived
   * from `agent_skills`, never written through the agent endpoints.
   *
   * Required on purpose, with no `.default(0)`. No `Agent` DTO is ever
   * persisted (the version snapshot is `AgentVersionConfig`, not this shape),
   * so there is no old payload to stay compatible with — and a default would
   * turn a missing count into a confident "0" in the sentence the delete
   * dialog asks the user to act on.
   */
  skill_count: z.number().int(),
});
export type Agent = z.infer<typeof Agent>;

export const AgentSkillLink = z.object({
  agent_id: z.string(),
  skill_id: z.string(),
  order: z.number().int(),
  /**
   * Whether this skill reaches the agent's prompt. A link row records a
   * POSITION, which a disabled skill keeps — so unchecking a row in the Skills
   * tab leaves it where it is instead of sinking it below the enabled ones.
   */
  enabled: z.boolean(),
});
export type AgentSkillLink = z.infer<typeof AgentSkillLink>;

// The immutable config snapshot captured in `agent_versions` whenever an agent's
// config changes (everything but `enabled`). Mirrors the shape written by the
// agents repository — provider/model/prompt/output_schema/strategy/gate/repo_intel
// plus the ordered skill ids linked at snapshot time. Used for reproducibility
// (eval replays a past version) and for surfacing an agent's edit history.
export const AgentVersionConfig = z.object({
  provider: Provider,
  model: z.string(),
  system_prompt: z.string(),
  output_schema: z.unknown().nullish(),
  strategy: ReviewStrategy,
  ci_fail_on: CiFailOn,
  repo_intel: z.boolean(),
  skills: z.array(z.string()),
});
export type AgentVersionConfig = z.infer<typeof AgentVersionConfig>;

export const AgentVersion = z.object({
  agent_id: z.string(),
  version: z.number().int(),
  config: AgentVersionConfig,
  created_at: z.string(),
});
export type AgentVersion = z.infer<typeof AgentVersion>;
