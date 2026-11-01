/**
 * Onboarding Tour (L05) — status, blockers and tour assembly (plan step 26).
 *
 * Expected values come from AC-07, AC-12 … AC-16, AC-26, AC-34, AC-38, AC-45,
 * AC-51, AC-58, AC-59, AC-69, AC-74, AC-84, AC-86 and D-23, D-24, D-41, D-45.
 * The code is only the seam (`onboarding/helpers.ts`).
 */
import { describe, it, expect } from 'vitest';
import {
  coveragePartial,
  deriveStatus,
  noCloneSections,
  skeletonSections,
  toTourDto,
  type TourIndexState,
  type TourRepo,
} from '../src/modules/onboarding/helpers.js';
import type { StoredTour } from '../src/modules/onboarding/schema.js';
import type { TourSections } from '@devdigest/shared';
import { makeFacts, prCandidate, todoCandidate } from './helpers/onboarding-facts.js';

const SECTION_KEYS = ['architecture', 'critical_paths', 'run_locally', 'reading_path', 'first_tasks'];

const REPO: TourRepo = { id: 'r1', name: 'payments-api', fullName: 'acme/payments-api', defaultBranch: 'main', clonePath: '/clones/acme/payments-api' };
const index = (over: Partial<TourIndexState> = {}): TourIndexState => ({
  status: 'full',
  lastIndexedSha: 'def',
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  ...over,
});
const status = (over: Partial<Parameters<typeof deriveStatus>[0]> = {}) =>
  deriveStatus({ clonePath: REPO.clonePath, indexState: index(), indexedCount: 5, storedValid: false, keyMissing: false, running: false, ...over });

const API_KEY = { provider: 'openrouter', model: 'm', missing: false };
const GEN = { running: false, failure: null };

function stored(over: Partial<StoredTour> = {}): StoredTour {
  return {
    v: 1,
    revision: 'abc',
    index_files: 4200,
    source_files: 12450,
    coverage_partial: true,
    index_partial: false,
    trimmed: false,
    provider: 'openrouter',
    model: 'deepseek/deepseek-v4-flash',
    cost_usd: 0.0123,
    sections: skeletonSections(makeFacts(), []),
    ...over,
  };
}

const dto = (opts: { st: ReturnType<typeof deriveStatus>; sections: TourSections; s?: StoredTour | null; sha?: string }) =>
  toTourDto({
    repo: REPO,
    status: opts.st,
    sections: opts.sections,
    stored: opts.s ? { tour: opts.s, generatedAt: new Date('2026-10-30T10:00:00Z') } : null,
    revision: 'def',
    currentIndexSha: opts.sha ?? 'def',
    apiKey: API_KEY,
    generation: GEN,
  });

describe('no clone (AC-14, AC-58, AC-59)', () => {
  it('AC-14, AC-58 — not_cloned, Generate off; four sections need a clone; first tasks = open-PR fallbacks', () => {
    const st = status({ clonePath: null, indexState: index({ status: 'degraded', degradedReason: 'no_clone' }), indexedCount: 0 });
    expect(st.status).toBe('not_cloned');
    expect(st.can_generate).toBe(false);
    const s = noCloneSections([prCandidate(7, 'Fix login'), prCandidate(3, 'Bump deps')]);
    expect(s.architecture.gap).toBe('needs_clone');
    expect(s.critical_paths.gap).toBe('needs_clone');
    expect(s.run_locally.gap).toBe('needs_clone');
    expect(s.reading_path.gap).toBe('needs_clone');
    expect(s.first_tasks.gap).toBeNull();
    expect(s.first_tasks.tasks.map((t) => [t.kind, t.source, t.pr_number])).toEqual([
      ['open-pr', 'fallback', 7],
      ['open-pr', 'fallback', 3],
    ]);
  });

  it('AC-59 — no PRs → no_candidates', () => {
    const s = noCloneSections([]);
    expect(s.first_tasks).toEqual({ tasks: [], gap: 'no_candidates' });
  });
});

describe('index not ready (AC-15, AC-51)', () => {
  it.each([
    ['degraded', index({ status: 'degraded', degradedReason: 'no_data' }), 5],
    ['failed', index({ status: 'failed', reason: 'index_failed' }), 5],
    ['full but nothing ranked', index({ status: 'full' }), 0],
  ])('AC-15 — %s → index_not_ready, Generate off, with a reason', (_label, ix, count) => {
    const st = status({ indexState: ix, indexedCount: count });
    expect(st.status).toBe('index_not_ready');
    expect(st.can_generate).toBe(false);
    expect(st.index_reason).not.toBeNull();
    expect(st.blockers).toEqual(['index_not_ready']);
  });

  it('AC-51, D-24 — nothing ranked → reading path not_ranked, reason not_ranked', () => {
    const st = status({ indexedCount: 0 });
    expect(st.index_reason).toBe('not_ranked');
    const s = skeletonSections(makeFacts({ indexed: [], readingPaths: [], chains: [] }), []);
    expect(s.reading_path.gap).toBe('not_ranked');
  });
});

describe('ready and partial (AC-16, AC-26)', () => {
  it('AC-16 — a partial index with a ranking may generate', () => {
    const st = status({ indexState: index({ status: 'partial' }) });
    expect(st.can_generate).toBe(true);
    expect(st.blockers).toEqual([]);
  });

  it('AC-26 — cloned, ranked, nothing stored → ready, can_generate, meta null, deterministic sections', () => {
    const st = status();
    expect(st.status).toBe('ready');
    expect(st.can_generate).toBe(true);
    const facts = makeFacts();
    const sections = skeletonSections(facts, []);
    const out = dto({ st, sections });
    expect(out.meta).toBeNull();
    expect(out.sections.reading_path.rows.map((r) => r.path)).toEqual(facts.readingPaths);
    expect(out.sections.run_locally.commands).toEqual([{ step: 1, command: 'npm run dev', comment: null }]);
    expect(out.sections.architecture.prose).toBeNull();
  });

  it('a running generation turns Generate off', () => {
    expect(status({ running: true }).can_generate).toBe(false);
  });
});

describe('sections shape (AC-07, AC-34, AC-38, AC-45)', () => {
  it('AC-07 — every status yields exactly the five section keys', () => {
    const all = [
      noCloneSections([]),
      skeletonSections(makeFacts(), []),
      skeletonSections(makeFacts({ indexed: [], readingPaths: [], chains: [], commands: [] }), []),
      stored().sections,
    ];
    for (const s of all) expect(Object.keys(s).sort()).toEqual([...SECTION_KEYS].sort());
  });

  it('AC-34 — the skeleton architecture has stack and folders, no prose, no diagram', () => {
    const facts = makeFacts();
    const a = skeletonSections(facts, []).architecture;
    expect(a.prose).toBeNull();
    expect(a.components).toEqual([]);
    expect(a.stack).toEqual(facts.stack);
    expect(a.folders).toEqual(facts.folders);
  });

  it('AC-38 — no edges → critical paths no_edges; AC-45 — no commands → run locally no_manifest', () => {
    const s = skeletonSections(makeFacts({ chains: [], commands: [] }), []);
    expect(s.critical_paths).toEqual({ rows: [], gap: 'no_edges' });
    expect(s.run_locally).toEqual({ commands: [], gap: 'no_manifest' });
  });

  it('AC-56 — skeleton first tasks are the fallback candidates', () => {
    const s = skeletonSections(makeFacts(), [todoCandidate('src/a.ts', 3)]);
    expect(s.first_tasks.tasks.map((t) => [t.candidate_id, t.source])).toEqual([['todo:src/a.ts:3', 'fallback']]);
  });
});

describe('meta of a stored tour (AC-12, AC-13, AC-69, AC-74, AC-84)', () => {
  it('AC-12, AC-13 — header numbers come from the envelope', () => {
    const out = dto({ st: status({ storedValid: true }), sections: stored().sections, s: stored() });
    expect(out.status).toBe('generated');
    expect(out.meta).toMatchObject({ index_files: 4200, source_files: 12450, coverage_partial: true, generated_at: '2026-10-30T10:00:00.000Z' });
  });

  it('AC-13, D-23 — coverage_partial for bounded > 0 or softBudgetReached, false for neither', () => {
    const cov = (bounded: number, softBudgetReached: boolean) =>
      coveragePartial(index({ coverage: { totalSourceFiles: 12450, bounded, softBudgetReached } }));
    expect(cov(7450, false)).toBe(true);
    expect(cov(0, true)).toBe(true);
    expect(cov(0, false)).toBe(false);
  });

  it('AC-74 — stored revision differs from the index sha → outdated; equal → not', () => {
    expect(dto({ st: status({ storedValid: true }), sections: stored().sections, s: stored({ revision: 'abc' }), sha: 'def' }).meta!.outdated).toBe(true);
    expect(dto({ st: status({ storedValid: true }), sections: stored().sections, s: stored({ revision: 'def' }), sha: 'def' }).meta!.outdated).toBe(false);
  });

  it('AC-84 — provider, model and cost come from the envelope; a null cost stays null', () => {
    const m = dto({ st: status({ storedValid: true }), sections: stored().sections, s: stored() }).meta!;
    expect([m.provider, m.model, m.cost_usd]).toEqual(['openrouter', 'deepseek/deepseek-v4-flash', 0.0123]);
    expect(dto({ st: status({ storedValid: true }), sections: stored().sections, s: stored({ cost_usd: null }) }).meta!.cost_usd).toBeNull();
  });

  it('AC-69 — trimmed mirrors the envelope', () => {
    expect(dto({ st: status({ storedValid: true }), sections: stored().sections, s: stored({ trimmed: true }) }).meta!.trimmed).toBe(true);
    expect(dto({ st: status({ storedValid: true }), sections: stored().sections, s: stored({ trimmed: false }) }).meta!.trimmed).toBe(false);
  });

  it('GitHub links point at the stored revision', () => {
    expect(dto({ st: status({ storedValid: true }), sections: stored().sections, s: stored({ revision: 'abc' }) }).revision).toBe('abc');
  });
});

describe('blockers (AC-86, D-41, D-45)', () => {
  it('AC-86 — key missing on a cloned, ranked repo → [no_api_key], Generate off', () => {
    const st = status({ keyMissing: true });
    expect(st.blockers).toEqual(['no_api_key']);
    expect(st.can_generate).toBe(false);
  });

  it('AC-86, D-41 — uncloned without a key → [not_cloned, no_api_key] in that order', () => {
    expect(status({ clonePath: null, indexedCount: 0, keyMissing: true }).blockers).toEqual(['not_cloned', 'no_api_key']);
  });

  it('AC-86 — key present → no no_api_key', () => {
    expect(status({ keyMissing: false }).blockers).not.toContain('no_api_key');
  });

  it('D-45 — a stored tour on a now-uncloned repo stays generated, blocked by not_cloned', () => {
    const st = status({ clonePath: null, indexedCount: 0, storedValid: true });
    expect(st.status).toBe('generated');
    expect(st.blockers).toContain('not_cloned');
    expect(st.can_generate).toBe(false);
    const s = stored();
    expect(dto({ st, sections: s.sections, s }).sections).toEqual(s.sections);
  });

  it('D-45 — a stored tour on a now-degraded index stays generated, blocked by index_not_ready', () => {
    const st = status({ indexState: index({ status: 'degraded', degradedReason: 'no_data' }), storedValid: true });
    expect(st.status).toBe('generated');
    expect(st.blockers).toContain('index_not_ready');
    expect(st.can_generate).toBe(false);
  });
});
