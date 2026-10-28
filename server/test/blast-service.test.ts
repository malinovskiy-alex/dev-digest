/**
 * blast — BlastService with fake deps (no DB, no container).
 */
import { describe, it, expect, vi } from 'vitest';
import { BlastService } from '../src/modules/blast/service.js';
import { toBlastRadius } from '../src/modules/blast/helpers.js';
import { NotFoundError } from '../src/platform/errors.js';
import type {
  BlastFacadeResult,
  BlastIndexView,
  BlastServiceDeps,
} from '../src/modules/blast/types.js';

const FACADE: BlastFacadeResult = {
  changedSymbols: [{ file: 'src/ctx.ts', name: 'getContext', kind: 'function' }],
  callers: [
    { file: 'src/a/routes.ts', symbol: 'aRoutes', viaSymbol: 'getContext', line: 10, rank: 0.5 },
  ],
  impactedEndpoints: ['GET /a'],
  factsByFile: { 'src/a/routes.ts': { endpoints: ['GET /a'], crons: [] } },
  degraded: false,
};
const INDEX: BlastIndexView = { status: 'full', lastIndexedSha: 'sha-1' };

function makeDeps(opts: { pull?: boolean; facade?: BlastFacadeResult } = {}) {
  const getBlastRadius = vi.fn(async () => opts.facade ?? FACADE);
  const getIndexState = vi.fn(async () => INDEX);
  const getPull = vi.fn(async () =>
    opts.pull === false ? undefined : { id: 'pr-1', repoId: 'repo-1' },
  );
  const getPrFiles = vi.fn(async () => [{ path: 'src/ctx.ts' }, { path: 'README.md' }]);
  const deps: BlastServiceDeps = {
    pulls: { getPull, getPrFiles },
    repoIntel: { getBlastRadius, getIndexState },
  };
  return { deps, getBlastRadius, getIndexState, getPull, getPrFiles };
}

describe('BlastService.forPull', () => {
  it('unknown PR → NotFoundError, and the facade is never called', async () => {
    const { deps, getBlastRadius } = makeDeps({ pull: false });
    await expect(new BlastService(deps).forPull('ws', 'pr-x')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(getBlastRadius).not.toHaveBeenCalled();
  });

  it('reads the index once and maps it; logs one index read', async () => {
    const { deps, getBlastRadius, getIndexState, getPull } = makeDeps();
    const info = vi.fn();
    const out = await new BlastService(deps).forPull('ws-1', 'pr-1', { info });

    expect(getPull).toHaveBeenCalledWith('ws-1', 'pr-1');
    expect(getBlastRadius).toHaveBeenCalledTimes(1);
    expect(getBlastRadius).toHaveBeenCalledWith('repo-1', ['src/ctx.ts', 'README.md']);
    expect(getIndexState).toHaveBeenCalledTimes(1);
    expect(getIndexState).toHaveBeenCalledWith('repo-1');

    expect(info).toHaveBeenCalledTimes(1);
    const [obj, msg] = info.mock.calls[0]!;
    expect(msg).toBe('blast radius read from repo-intel index (no reparse, no LLM)');
    expect(obj).toMatchObject({ source: 'index', changedFiles: 2, callers: 1, endpoints: 1 });

    expect(out).toEqual(toBlastRadius(FACADE, INDEX));
  });

  it('logs source=fallback when the facade is degraded', async () => {
    const { deps } = makeDeps({
      facade: { ...FACADE, factsByFile: undefined, degraded: true, reason: 'no_data' },
    });
    const info = vi.fn();
    const out = await new BlastService(deps).forPull('ws-1', 'pr-1', { info });
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]![0]).toMatchObject({ source: 'fallback', reason: 'no_data' });
    expect(out.degraded).toBe(true);
  });
});
