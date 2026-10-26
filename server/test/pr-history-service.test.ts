/**
 * pr-history — PrHistoryService with fake deps (no DB, no GitHub).
 */
import { describe, it, expect, vi } from 'vitest';
import type { PrFile } from '@devdigest/shared';
import { PrHistoryService } from '../src/modules/pr-history/service.js';
import { PRIOR_PR_FETCH_BUDGET } from '../src/modules/pr-history/constants.js';
import { NotFoundError } from '../src/platform/errors.js';
import type {
  HistoryGitHub,
  HistoryPullSource,
  MergedPull,
} from '../src/modules/pr-history/types.js';

const CURRENT = { id: 'pr-cur', repoId: 'repo-1' };

function merged(n: number): MergedPull {
  return {
    id: `id-${n}`,
    number: n,
    title: `PR ${n}`,
    author: 'dev',
    updatedAt: new Date(Date.UTC(2026, 0, n)),
  };
}

function file(path: string): PrFile {
  return { path, additions: 1, deletions: 0, patch: null };
}

interface Setup {
  pull?: boolean;
  candidates?: MergedPull[];
  cached?: Record<string, string[]>;
  ghFiles?: Record<number, string[]>;
  ghThrows?: boolean;
  failNumbers?: number[];
}

function setup(s: Setup = {}) {
  const cached = new Map(Object.entries(s.cached ?? {}));
  const replacePrFiles = vi.fn(async (_id: string, _files: PrFile[]) => {});
  const pulls: HistoryPullSource = {
    getPull: vi.fn(async () => (s.pull === false ? undefined : CURRENT)),
    getRepo: vi.fn(async () => ({ owner: 'acme', name: 'api' })),
    getPrFiles: vi.fn(async () => [{ path: 'a.ts' }, { path: 'b.ts' }]),
    listMergedPulls: vi.fn(async () => s.candidates ?? []),
    getPrFilePaths: vi.fn(async (ids: string[]) => {
      const m = new Map<string, string[]>();
      for (const id of ids) {
        const v = cached.get(id);
        if (v) m.set(id, v);
      }
      return m;
    }),
    replacePrFiles,
  };
  const listPullFiles = vi.fn(async (_repo: unknown, n: number) => {
    if (s.failNumbers?.includes(n)) throw new Error('rate limited');
    return (s.ghFiles?.[n] ?? ['a.ts']).map(file);
  });
  const gh: HistoryGitHub = { listPullFiles };
  const github = vi.fn(async () => {
    if (s.ghThrows) throw new Error('no GitHub token configured');
    return gh;
  });
  const service = new PrHistoryService({ pulls, github });
  return { service, pulls, github, listPullFiles, replacePrFiles };
}

describe('PrHistoryService.forPull', () => {
  it('unknown PR → NotFoundError, no GitHub call', async () => {
    const { service, github } = setup({ pull: false });
    await expect(service.forPull('ws', 'x')).rejects.toBeInstanceOf(NotFoundError);
    expect(github).not.toHaveBeenCalled();
  });

  it('all candidates cached → github() is not called', async () => {
    const { service, github, pulls } = setup({
      candidates: [merged(5), merged(6)],
      cached: { 'id-5': ['a.ts'], 'id-6': ['zzz.ts'] },
    });
    const out = await service.forPull('ws', 'pr-cur');
    expect(github).not.toHaveBeenCalled();
    expect(pulls.listMergedPulls).toHaveBeenCalledWith('ws', 'repo-1', 'pr-cur', 30);
    expect(out.history.map((h) => h.pr_number)).toEqual([5]);
    expect(out).toMatchObject({ candidates: 2, unchecked: 0, github_unavailable: false });
  });

  it('3 missing → 3 listPullFiles + 3 replacePrFiles, unchecked 0', async () => {
    const { service, listPullFiles, replacePrFiles } = setup({
      candidates: [merged(1), merged(2), merged(3)],
      ghFiles: { 1: ['a.ts'], 2: ['x.ts'], 3: ['b.ts', 'a.ts'] },
    });
    const info = vi.fn();
    const out = await service.forPull('ws', 'pr-cur', { info, warn: vi.fn() });
    expect(listPullFiles).toHaveBeenCalledTimes(3);
    expect(replacePrFiles).toHaveBeenCalledTimes(3);
    expect(replacePrFiles.mock.calls.map((c) => c[0]).sort()).toEqual(['id-1', 'id-2', 'id-3']);
    expect(out.history.map((h) => h.pr_number)).toEqual([3, 1]);
    expect(out.history[0]!.files_overlap).toEqual(['a.ts', 'b.ts']);
    expect(out).toMatchObject({ candidates: 3, unchecked: 0, github_unavailable: false });
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]![1]).toBe('prior PRs from synced merged PRs');
    expect(info.mock.calls[0]![0]).toMatchObject({ fetched: 3, cached: 0, unchecked: 0 });
  });

  it('12 missing → budget fetched, rest unchecked, not "unavailable"', async () => {
    const candidates = Array.from({ length: 12 }, (_, i) => merged(i + 1));
    const { service, listPullFiles } = setup({ candidates });
    const out = await service.forPull('ws', 'pr-cur');
    expect(PRIOR_PR_FETCH_BUDGET).toBe(8);
    expect(listPullFiles).toHaveBeenCalledTimes(8);
    expect(out).toMatchObject({ candidates: 12, unchecked: 4, github_unavailable: false });
    expect(out.history).toHaveLength(8);
  });

  it('github() throws → cached matches still returned, all missing unchecked', async () => {
    const { service, listPullFiles } = setup({
      candidates: [merged(5), merged(6), merged(7)],
      cached: { 'id-5': ['a.ts'] },
      ghThrows: true,
    });
    const warn = vi.fn();
    const out = await service.forPull('ws', 'pr-cur', { info: vi.fn(), warn });
    expect(listPullFiles).not.toHaveBeenCalled();
    expect(out.history.map((h) => h.pr_number)).toEqual([5]);
    expect(out).toMatchObject({ candidates: 3, unchecked: 2, github_unavailable: true });
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/token\s*[:=]/i);
  });

  it('one listPullFiles rejects → that PR is unchecked, the others succeed', async () => {
    const { service, replacePrFiles } = setup({
      candidates: [merged(1), merged(2), merged(3)],
      failNumbers: [2],
    });
    const out = await service.forPull('ws', 'pr-cur', { info: vi.fn(), warn: vi.fn() });
    expect(replacePrFiles).toHaveBeenCalledTimes(2);
    expect(out.history.map((h) => h.pr_number)).toEqual([3, 1]);
    expect(out).toMatchObject({ unchecked: 1, github_unavailable: true });
  });

  it('the current PR is never its own prior PR', async () => {
    const { service } = setup({
      candidates: [{ ...merged(9), id: CURRENT.id }, merged(5)],
      cached: { [CURRENT.id]: ['a.ts'], 'id-5': ['a.ts'] },
    });
    const out = await service.forPull('ws', 'pr-cur');
    expect(out.history.map((h) => h.pr_number)).toEqual([5]);
    expect(out.candidates).toBe(1);
  });
});
