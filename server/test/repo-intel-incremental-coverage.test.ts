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

const { runIncremental } = await import('../src/modules/repo-intel/pipeline/incremental.js');

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
