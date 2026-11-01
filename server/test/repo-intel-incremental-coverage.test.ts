/**
 * repo-intel `runIncremental` — what the refresh writes as the index's coverage
 * (L05 onboarding header, AC-13, AC-87). Regressions for findings F-09 and F-10.
 *
 *   - F-09: an incremental pass re-parses only the changed slice, so files a
 *     soft-budgeted full pass never parsed stay unparsed. It must keep the prior
 *     `softBudgetReached`, on the walk-ok and on the walk-failed branch — else
 *     the header claims full coverage (AC-13).
 *   - F-10: `filesIndexed` is N = the `file_rank` rows (AC-87). When the walk,
 *     the graph or the resolve throws, the rank is not rewritten, so the prior
 *     N must stay — not the walk's length.
 *
 * The repository is an in-memory stub and the walk is mocked, so the branch
 * under test is chosen exactly; the changed file is a real file in a tmp dir
 * so the slice re-parse itself is clean. No database.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { RepoIntelRepository } from '../src/modules/repo-intel/repository.js';
import { INDEXER_VERSION } from '../src/modules/repo-intel/constants.js';
import type { IndexState } from '../src/modules/repo-intel/types.js';
import type { Container } from '../src/platform/container.js';
import type { WalkResult } from '../src/modules/repo-intel/pipeline/walk.js';

const walk = vi.hoisted(() => ({
  impl: (async () => {
    throw new Error('walk not configured');
  }) as (root: string) => Promise<WalkResult>,
}));
vi.mock('../src/modules/repo-intel/pipeline/walk.js', () => ({
  walkClone: (root: string) => walk.impl(root),
}));

const { runIncremental, refreshCounts } = await import('../src/modules/repo-intel/pipeline/incremental.js');

const PRIOR_N = 5;
const WALK_FILES = ['src/a.ts', 'src/b.ts', 'src/changed.ts', 'src/d.ts', 'src/e.ts', 'src/f.ts', 'src/g.ts'];

interface Upsert {
  filesIndexed: number;
  status: string;
  stats: Record<string, unknown>;
}

function priorState(softBudgetReached: boolean): IndexState {
  return {
    repoId: 'r1',
    status: 'partial',
    filesIndexed: PRIOR_N,
    filesSkipped: 0,
    durationMs: 1,
    lastIndexedSha: 'sha-old',
    indexerVersion: INDEXER_VERSION,
    updatedAt: new Date(0),
    coverage: { totalSourceFiles: 900, bounded: 0, softBudgetReached },
  };
}

function makeStub(root: string, state: IndexState, fail: { resolve?: boolean } = {}) {
  const upserts: Upsert[] = [];
  const rankWrites: unknown[][] = [];
  const stub = {
    getRepoBasics: async () => ({ id: 'r1', owner: 'acme', name: 'app', clonePath: root }),
    tryGetIndexState: async () => state,
    deleteForFiles: async () => {},
    insertSymbols: async () => {},
    insertReferences: async () => {},
    patchFileFacts: async () => {},
    replaceEdges: async () => {},
    resolveReferences: async () => {
      if (fail.resolve) throw new Error('resolve exploded');
    },
    replaceFileRank: async (_id: string, rows: unknown[]) => {
      rankWrites.push(rows);
    },
    getRepoMapCandidates: async () => [],
    deleteRepoMapCache: async () => {},
    putRepoMapCache: async () => {},
    upsertIndexState: async (s: Upsert) => {
      upserts.push(s);
    },
  };
  return { repo: stub as unknown as RepoIntelRepository, upserts, rankWrites };
}

function makeContainer(fail: { graph?: boolean } = {}): Container {
  return {
    git: {
      currentHead: async () => 'sha-new',
      diffNameOnly: async () => ['src/changed.ts'],
    },
    depgraph: {
      buildEdges: async () => {
        if (fail.graph) throw new Error('depgraph exploded');
        return [];
      },
    },
    tokenizer: { count: (text: string) => Math.ceil(text.length / 4) },
  } as unknown as Container;
}

const walkOk = async (): Promise<WalkResult> => ({
  files: WALK_FILES,
  stats: { totalCandidates: WALK_FILES.length, skippedTooLarge: 0, bounded: 0 },
});
const walkFails = async (): Promise<WalkResult> => {
  throw new Error('walk exploded');
};

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'repo-intel-inc-cov-'));
  const file = join(root, 'src', 'changed.ts');
  await mkdir(dirname(file), { recursive: true }); // dirname, so it works on Windows too
  await writeFile(file, 'export function fresh(x: number) { return x; }\n');
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('regression F-09 — incremental keeps a prior softBudgetReached (AC-13, AC-87)', () => {
  it.each([
    ['walk ok', walkOk],
    ['walk failed', walkFails],
  ])('F-09, AC-13 — prior soft budget reached → still reached after the refresh (%s)', async (_branch, impl) => {
    walk.impl = impl;
    const s = makeStub(root, priorState(true));
    await runIncremental(makeContainer(), s.repo, { repoId: 'r1' });
    expect(s.upserts).toHaveLength(1);
    expect(s.upserts[0]!.stats.softBudgetReached).toBe(true);
  });

  it('F-09 — control: a prior pass that stayed in budget is still reported as in budget', async () => {
    walk.impl = walkOk;
    const s = makeStub(root, priorState(false));
    await runIncremental(makeContainer(), s.repo, { repoId: 'r1' });
    expect(s.upserts[0]!.stats.softBudgetReached).toBe(false);
  });
});

describe('regression F-10 — a failed graph/rank step keeps the old filesIndexed (AC-87)', () => {
  it('F-10, AC-87 — a clean refresh writes N = the file_rank rows it wrote', async () => {
    walk.impl = walkOk;
    const s = makeStub(root, priorState(false));
    await runIncremental(makeContainer(), s.repo, { repoId: 'r1' });
    expect(s.rankWrites).toHaveLength(1);
    expect(s.rankWrites[0]).toHaveLength(WALK_FILES.length);
    expect(s.upserts[0]!.filesIndexed).toBe(WALK_FILES.length);
  });

  it.each([
    ['the walk throws', walkFails, {}, {}],
    ['buildEdges throws', walkOk, { graph: true }, {}],
    ['resolveReferences throws', walkOk, {}, { resolve: true }],
  ] as const)('F-10, AC-87 — %s → rank not rewritten, filesIndexed stays the prior N', async (_why, impl, cFail, rFail) => {
    walk.impl = impl;
    const s = makeStub(root, priorState(false), rFail);
    await runIncremental(makeContainer(cFail), s.repo, { repoId: 'r1' });
    expect(s.rankWrites).toHaveLength(0);
    expect(s.upserts).toHaveLength(1);
    expect(s.upserts[0]!.filesIndexed).toBe(PRIOR_N);
    expect(s.upserts[0]!.status).toBe('partial');
  });
});

// ---------------------------------------------------------------------------
// F-54 (AC-87): the refreshed counters on the full pass's terms — indexed =
// walked files that are parsed; skipped = too large + walked files that failed
// to read or parse; indexed + skipped <= the walk's candidates.
// ---------------------------------------------------------------------------

describe('refreshCounts (F-54, AC-87)', () => {
  const files = (n: number, prefix = 'src/f') => Array.from({ length: n }, (_, i) => `${prefix}${i}.ts`);
  const walkOf = (list: string[], skippedTooLarge = 0): WalkResult => ({
    files: list,
    stats: { totalCandidates: list.length + skippedTooLarge, skippedTooLarge, bounded: 0 },
  });
  type Prior = Parameters<typeof refreshCounts>[0]['prior'];
  const prior = (over: Partial<Prior> = {}): Prior => ({
    filesIndexed: 0,
    filesSkipped: 0,
    softBudgetReached: false,
    lastPass: { parseDegraded: [], skippedTooLarge: 0, filesSeen: null },
    ...over,
  });

  it('F-54 — a prior parse failure outside the slice stays skipped (and listed)', () => {
    const list = [...files(4), 'src/bad.ts'];
    const r = refreshCounts({
      prior: prior({ filesIndexed: 4, filesSkipped: 1, lastPass: { parseDegraded: [{ file: 'src/bad.ts', reason: 'x' }], skippedTooLarge: 0, filesSeen: 5 } }),
      walk: walkOf(list),
      changed: ['src/f0.ts'],
      sliceFailed: [],
      rankWritten: true,
    });
    expect(r).toEqual({ filesIndexed: 4, filesSkipped: 1, parseDegraded: [{ file: 'src/bad.ts', reason: 'x' }] });
  });

  it('F-54 — a prior failure that the slice parses now counts as indexed', () => {
    const list = [...files(4), 'src/bad.ts'];
    const r = refreshCounts({
      prior: prior({ filesIndexed: 4, filesSkipped: 1, lastPass: { parseDegraded: [{ file: 'src/bad.ts', reason: 'x' }], skippedTooLarge: 0, filesSeen: 5 } }),
      walk: walkOf(list),
      changed: ['src/bad.ts'],
      sliceFailed: [],
      rankWritten: true,
    });
    expect(r).toEqual({ filesIndexed: 5, filesSkipped: 0, parseDegraded: [] });
  });

  it('F-54 — a slice file deleted from disk counts nowhere', () => {
    const r = refreshCounts({
      prior: prior({ filesIndexed: 5, filesSkipped: 0, lastPass: { parseDegraded: [], skippedTooLarge: 0, filesSeen: 5 } }),
      walk: walkOf(files(4)), // src/gone.ts is no longer on disk
      changed: ['src/gone.ts'],
      sliceFailed: [{ file: 'src/gone.ts', reason: 'ENOENT' }],
      rankWritten: true,
    });
    expect(r).toEqual({ filesIndexed: 4, filesSkipped: 0, parseDegraded: [] });
  });

  it('F-54 — a slice file that fails to parse is skipped and listed; too-large files stay skipped', () => {
    const r = refreshCounts({
      prior: prior({ filesIndexed: 5, filesSkipped: 2, lastPass: { parseDegraded: [], skippedTooLarge: 2, filesSeen: 5 } }),
      walk: walkOf(files(5), 2),
      changed: ['src/f1.ts'],
      sliceFailed: [{ file: 'src/f1.ts', reason: 'timeout' }],
      rankWritten: true,
    });
    expect(r).toEqual({ filesIndexed: 4, filesSkipped: 3, parseDegraded: [{ file: 'src/f1.ts', reason: 'timeout' }] });
  });

  it('F-54 — invariant over seeded cases: indexed + skipped <= totalCandidates, both >= 0', () => {
    let seed = 54;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let t = 0; t < 300; t += 1) {
      const n = Math.floor(rnd() * 40);
      const list = files(n);
      const tooLarge = Math.floor(rnd() * 5);
      const failedPrior = list.filter(() => rnd() < 0.2).map((file) => ({ file, reason: 'p' }));
      const priorSkipped = failedPrior.length + Math.floor(rnd() * 5) + tooLarge;
      const changed = [...list.filter(() => rnd() < 0.3), ...(rnd() < 0.3 ? ['src/deleted.ts'] : [])];
      const sliceFailed = changed.filter(() => rnd() < 0.3).map((file) => ({ file, reason: 's' }));
      const softBudgetReached = rnd() < 0.2;
      const r = refreshCounts({
        prior: prior({
          filesIndexed: Math.floor(rnd() * (n + 5)),
          filesSkipped: priorSkipped,
          softBudgetReached,
          lastPass: { parseDegraded: failedPrior, skippedTooLarge: tooLarge, filesSeen: softBudgetReached ? n + Math.floor(rnd() * 10) : null },
        }),
        walk: walkOf(list, tooLarge),
        changed,
        sliceFailed,
        rankWritten: rnd() < 0.8,
      });
      expect(r.filesIndexed).toBeGreaterThanOrEqual(0);
      expect(r.filesSkipped).toBeGreaterThanOrEqual(0);
      expect(r.filesIndexed + r.filesSkipped, `case ${t}`).toBeLessThanOrEqual(list.length + tooLarge);
      for (const e of r.parseDegraded) expect(list).toContain(e.file); // only walked files are listed
    }
  });

  it('F-54 — a capped prior list: the failures it could not name are assumed still unparsed', () => {
    const list = files(100);
    const listed = list.slice(0, 50).map((file) => ({ file, reason: 'p' })); // the 50-entry cap
    const r = refreshCounts({
      prior: prior({ filesIndexed: 40, filesSkipped: 60, lastPass: { parseDegraded: listed, skippedTooLarge: 0, filesSeen: 100 } }),
      walk: walkOf(list),
      changed: [list[99]!], // a clean, already-indexed file
      sliceFailed: [],
      rankWritten: true,
    });
    expect(r.filesIndexed).toBe(40); // 100 − 50 listed − 10 unlisted
    expect(r.filesSkipped).toBe(60);
    expect(r.parseDegraded).toHaveLength(50);
  });

  it('F-54, F-09 — after a soft-budgeted full pass the files it never reached stay out of filesIndexed', () => {
    const r = refreshCounts({
      prior: prior({ filesIndexed: 70, filesSkipped: 0, softBudgetReached: true, lastPass: { parseDegraded: [], skippedTooLarge: 0, filesSeen: 100 } }),
      walk: walkOf(files(100)),
      changed: ['src/f0.ts'],
      sliceFailed: [],
      rankWritten: true,
    });
    expect(r.filesIndexed).toBe(70);
    expect(r.filesSkipped).toBe(0);
  });

  it('F-54, F-10 — rank not rewritten → never more than the prior N', () => {
    const r = refreshCounts({
      prior: prior({ filesIndexed: 5, filesSkipped: 0, lastPass: { parseDegraded: [], skippedTooLarge: 0, filesSeen: 5 } }),
      walk: walkOf(files(7)),
      changed: ['src/f6.ts'],
      sliceFailed: [],
      rankWritten: false,
    });
    expect(r.filesIndexed).toBe(5);
  });

  it('F-54 — walk failed → both prior counters carried; the list drops re-parsed files and adds new failures', () => {
    const r = refreshCounts({
      prior: prior({
        filesIndexed: 8,
        filesSkipped: 2,
        lastPass: { parseDegraded: [{ file: 'src/a.ts', reason: 'p' }, { file: 'src/b.ts', reason: 'p' }], skippedTooLarge: 0, filesSeen: 10 },
      }),
      walk: undefined,
      changed: ['src/a.ts', 'src/c.ts'],
      sliceFailed: [{ file: 'src/c.ts', reason: 's' }],
      rankWritten: false,
    });
    expect(r).toEqual({
      filesIndexed: 8,
      filesSkipped: 2,
      parseDegraded: [{ file: 'src/b.ts', reason: 'p' }, { file: 'src/c.ts', reason: 's' }],
    });
  });
});
