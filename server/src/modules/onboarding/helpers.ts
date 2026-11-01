/**
 * Onboarding Tour (L05) — tour assembly. Ring 1, pure: status and blockers,
 * the three section shapes (no clone, skeleton, generated) and the DTO.
 *
 * `sections` always carries all five keys (AC-07): a section with nothing to
 * show says why through `gap`. A valid stored tour is always shown, whatever
 * the clone and index state since (D-45); the blockers still say why
 * Regenerate is off.
 */
import type {
  OnboardingTour,
  TourApiKey,
  TourBlocker,
  TourGeneration,
  TourSections,
  TourStack,
  TourStatus,
} from '@devdigest/shared';
import {
  criticalRows,
  readingRows,
  type TaskCandidate,
  type TourFacts,
} from './facts/helpers.js';
import {
  buildKnownSet,
  buildRefSet,
  fallbackTasks,
  groundComponents,
  groundTasks,
  mergeReasons,
  orderCommands,
  scrubProse,
} from './grounding/helpers.js';
import type { StoredTour, TourNarrative } from './schema.js';

/** The index state fields the tour reads (structurally the facade's `IndexState`). */
export interface TourIndexState {
  status: string;
  lastIndexedSha: string;
  updatedAt: Date;
  reason?: string;
  degradedReason?: string;
  coverage?: { totalSourceFiles: number | null; bounded: number; softBudgetReached: boolean };
}

/** The repo fields the tour reads. */
export interface TourRepo {
  id: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  clonePath: string | null;
}

const BLOCKED_INDEX = new Set(['degraded', 'failed']);

/** Whether an index can feed a generation: not degraded/failed and ranked (AC-15, AC-16). */
export function indexReady(indexState: TourIndexState, indexedCount: number): boolean {
  return !BLOCKED_INDEX.has(indexState.status) && indexedCount > 0;
}

/** `degradedReason ?? reason ?? status`, or `not_ranked` when only the ranking is missing (D-24). */
export function indexReason(indexState: TourIndexState, indexedCount: number): string | null {
  if (BLOCKED_INDEX.has(indexState.status)) {
    return indexState.degradedReason ?? indexState.reason ?? indexState.status;
  }
  return indexedCount > 0 ? null : 'not_ranked';
}

/** `bounded > 0 OR softBudgetReached` (D-23, AC-13). */
export function coveragePartial(indexState: TourIndexState): boolean {
  const c = indexState.coverage;
  return !!c && (c.bounded > 0 || c.softBudgetReached);
}

/**
 * Status, reason, blockers and whether Generate is on (D-24, D-41, D-45).
 * Blockers in fixed order: `not_cloned`, `index_not_ready` (only when cloned),
 * `no_api_key` (independent of the other two).
 */
export function deriveStatus(input: {
  clonePath: string | null;
  indexState: TourIndexState;
  indexedCount: number;
  storedValid: boolean;
  keyMissing: boolean;
  running: boolean;
}): { status: TourStatus; index_reason: string | null; blockers: TourBlocker[]; can_generate: boolean } {
  const cloned = input.clonePath !== null;
  const ready = indexReady(input.indexState, input.indexedCount);
  const blockers: TourBlocker[] = [];
  if (!cloned) blockers.push('not_cloned');
  if (cloned && !ready) blockers.push('index_not_ready');
  if (input.keyMissing) blockers.push('no_api_key');
  const status: TourStatus = input.storedValid
    ? 'generated'
    : !cloned
      ? 'not_cloned'
      : !ready
        ? 'index_not_ready'
        : 'ready';
  return {
    status,
    index_reason: indexReason(input.indexState, input.indexedCount),
    blockers,
    can_generate: blockers.length === 0 && !input.running,
  };
}

const EMPTY_STACK: TourStack = { languages: [], frameworks: [], runtime: [] };

/**
 * No clone (AC-58): everything but first tasks says "needs a clone"; first
 * tasks are the open-PR fallback tasks, or `no_candidates` (AC-59).
 */
export function noCloneSections(prCandidates: TaskCandidate[]): TourSections {
  const tasks = fallbackTasks(prCandidates);
  return {
    architecture: {
      prose: null,
      components: [],
      connections: [],
      stack: EMPTY_STACK,
      folders: [],
      gap: 'needs_clone',
    },
    critical_paths: { rows: [], gap: 'needs_clone' },
    run_locally: { commands: [], gap: 'needs_clone' },
    reading_path: { rows: [], gap: 'needs_clone' },
    first_tasks: { tasks, gap: tasks.length === 0 ? 'no_candidates' : null },
  };
}

/** A cloned repo with nothing stored: the deterministic sections (AC-26, AC-15, AC-34). */
export function skeletonSections(facts: TourFacts, candidates: TaskCandidate[]): TourSections {
  const ranked = facts.indexed.length > 0;
  const critical = criticalRows(facts.chains, facts.indexed);
  const reading = readingRows(facts.readingPaths, facts.indexed);
  const commands = facts.commands.map((c, i) => ({ step: i + 1, command: c.command, comment: null }));
  const tasks = fallbackTasks(candidates);
  return {
    architecture: {
      prose: null,
      components: [],
      connections: [],
      stack: facts.stack,
      folders: facts.folders,
      gap: ranked ? null : 'needs_index',
    },
    critical_paths: { rows: critical, gap: critical.length === 0 ? 'no_edges' : null },
    run_locally: { commands, gap: commands.length === 0 ? 'no_manifest' : null },
    reading_path: { rows: reading, gap: ranked && reading.length > 0 ? null : 'not_ranked' },
    first_tasks: { tasks, gap: tasks.length === 0 ? 'no_candidates' : null },
  };
}

/**
 * The skeleton's rows plus what survives grounding of the model's answer:
 * reasons and whys, ordered and commented commands, model tasks (or the
 * fallback), the grounded diagram and the scrubbed prose.
 */
export function generatedSections(
  facts: TourFacts,
  candidates: TaskCandidate[],
  narrative: TourNarrative,
): TourSections {
  const base = skeletonSections(facts, candidates);
  const indexedPaths = facts.indexed.map((f) => f.path);
  const known = buildKnownSet({ treePaths: facts.treePaths, indexedPaths });
  const refs = buildRefSet({
    indexedPaths,
    folders: facts.folders.map((f) => f.path),
    deps: facts.manifests.flatMap((m) => m.parsed?.deps ?? []),
  });
  const diagram = groundComponents(
    narrative.architecture.components,
    narrative.architecture.connections,
    refs,
  );
  const commands = orderCommands(facts.commands, narrative.commands);
  const tasks = groundTasks(candidates, narrative.tasks);
  const prose = scrubProse(narrative.architecture.prose, known);
  return {
    architecture: {
      ...base.architecture,
      prose: prose || null,
      components: diagram.components,
      connections: diagram.connections,
    },
    critical_paths: {
      ...base.critical_paths,
      rows: mergeReasons(
        base.critical_paths.rows,
        narrative.critical_paths.map((c) => ({ path: c.path, text: c.reason })),
        { ordered: false },
      ),
    },
    run_locally: { commands, gap: commands.length === 0 ? 'no_manifest' : null },
    reading_path: {
      ...base.reading_path,
      rows: mergeReasons(
        base.reading_path.rows,
        narrative.reading_path.map((r) => ({ path: r.path, text: r.why })),
        { ordered: true },
      ),
    },
    first_tasks: { tasks, gap: tasks.length === 0 ? 'no_candidates' : null },
  };
}

/**
 * The DTO. `meta` is non-null iff a stored tour is shown, with
 * `outdated = stored.revision !== current index sha` (AC-74).
 */
export function toTourDto(input: {
  repo: TourRepo;
  status: ReturnType<typeof deriveStatus>;
  sections: TourSections;
  stored: { tour: StoredTour; generatedAt: Date } | null;
  revision: string | null;
  currentIndexSha: string;
  apiKey: TourApiKey;
  generation: TourGeneration;
}): OnboardingTour {
  const s = input.stored;
  return {
    repo_id: input.repo.id,
    full_name: input.repo.fullName,
    name: input.repo.name,
    default_branch: input.repo.defaultBranch,
    status: input.status.status,
    index_reason: input.status.index_reason,
    revision: s ? s.tour.revision : input.revision,
    blockers: input.status.blockers,
    api_key: input.apiKey,
    can_generate: input.status.can_generate,
    generation: input.generation,
    meta: s
      ? {
          revision: s.tour.revision,
          generated_at: s.generatedAt.toISOString(),
          index_files: s.tour.index_files,
          source_files: s.tour.source_files,
          coverage_partial: s.tour.coverage_partial,
          index_partial: s.tour.index_partial,
          trimmed: s.tour.trimmed,
          provider: s.tour.provider,
          model: s.tour.model,
          cost_usd: s.tour.cost_usd,
          outdated: s.tour.revision !== input.currentIndexSha,
        }
      : null,
    sections: input.sections,
  };
}
