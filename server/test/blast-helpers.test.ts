/**
 * blast — the facade → BlastRadius mapping (P2.3). Pure, no DB.
 */
import { describe, it, expect } from 'vitest';
import { BlastRadius } from '@devdigest/shared';
import { summarize, toBlastRadius } from '../src/modules/blast/helpers.js';
import type { BlastFacadeResult, BlastIndexView } from '../src/modules/blast/types.js';

const FULL: BlastIndexView = { status: 'full', lastIndexedSha: 'sha-idx' };

function facade(over: Partial<BlastFacadeResult> = {}): BlastFacadeResult {
  return {
    changedSymbols: [
      { file: 'src/ctx.ts', name: 'getContext', kind: 'function' },
      { file: 'src/ctx.ts', name: 'requireRepo', kind: 'function' },
    ],
    callers: [
      { file: 'src/a/routes.ts', symbol: 'aRoutes', viaSymbol: 'getContext', line: 10, rank: 0.5 },
      { file: 'src/b/routes.ts', symbol: 'bRoutes', viaSymbol: 'getContext', line: 4, rank: 0.9 },
      { file: 'src/c/routes.ts', symbol: 'cRoutes', viaSymbol: 'requireRepo', line: 7, rank: 0.2 },
    ],
    impactedEndpoints: ['GET /a', 'GET /b', 'GET /c'],
    factsByFile: {
      'src/a/routes.ts': { endpoints: ['GET /a', 'GET /shared'], crons: [] },
      'src/b/routes.ts': { endpoints: ['GET /shared', 'GET /b', 'GET /b'], crons: ['nightly'] },
      'src/c/routes.ts': { endpoints: ['GET /c'], crons: [] },
    },
    degraded: false,
    ...over,
  };
}

describe('toBlastRadius', () => {
  it('groups by viaSymbol, orders by rank, attributes facts per caller file', () => {
    const b = toBlastRadius(facade(), FULL);

    // (a) two viaSymbols → two groups; (d) group order by top caller rank.
    expect(b.downstream.map((g) => g.symbol)).toEqual(['getContext', 'requireRepo']);

    // (d) callers within a group by rank desc.
    const g0 = b.downstream[0]!;
    expect(g0.callers.map((c) => c.file)).toEqual(['src/b/routes.ts', 'src/a/routes.ts']);
    expect(g0.callers[0]).toMatchObject({ name: 'bRoutes', line: 4 });

    // (c) group endpoints = deduplicated sorted union of that group's caller files; crons apart.
    expect(g0.endpoints_affected).toEqual(['GET /a', 'GET /b', 'GET /shared']);
    expect(g0.crons_affected).toEqual(['nightly']);
    expect(b.downstream[1]!.endpoints_affected).toEqual(['GET /c']);
    expect(b.downstream[1]!.crons_affected).toEqual([]);

    // (i) per-caller endpoints / crons are exactly that file's facts (deduplicated).
    expect(g0.callers[0]!.endpoints).toEqual(['GET /b', 'GET /shared']);
    expect(g0.callers[0]!.crons).toEqual(['nightly']);
    expect(g0.callers[1]!.endpoints).toEqual(['GET /a', 'GET /shared']);
    expect(g0.callers[1]!.crons).toEqual([]);

    // (f) counts from downstream; GET /shared counted once.
    expect(b.counts).toEqual({ symbols: 2, callers: 3, endpoints: 4, crons: 1 });
    expect(b.summary).toBe('2 symbols changed · 3 callers · 4 endpoints · 1 cron');

    // (j)
    expect(BlastRadius.parse(b)).toEqual(b);
  });

  it('drops a caller living in the file that declares the symbol (P2.5)', () => {
    const b = toBlastRadius(
      facade({
        callers: [
          { file: 'src/ctx.ts', symbol: 'requireRepo', viaSymbol: 'getContext', line: 30, rank: 1 },
          { file: 'src/a/routes.ts', symbol: 'aRoutes', viaSymbol: 'getContext', line: 10, rank: 0.5 },
        ],
      }),
      FULL,
    );
    expect(b.downstream).toHaveLength(1);
    expect(b.downstream[0]!.callers.map((c) => c.file)).toEqual(['src/a/routes.ts']);
    expect(BlastRadius.parse(b)).toEqual(b);
  });

  it('ties: caller count, then symbol name; callers by file then line', () => {
    const b = toBlastRadius(
      {
        changedSymbols: [
          { file: 'x.ts', name: 'zeta', kind: 'function' },
          { file: 'x.ts', name: 'alpha', kind: 'function' },
          { file: 'x.ts', name: 'beta', kind: 'function' },
        ],
        callers: [
          { file: 'b.ts', symbol: 'b', viaSymbol: 'zeta', line: 9, rank: 0 },
          { file: 'a.ts', symbol: 'a2', viaSymbol: 'zeta', line: 20, rank: 0 },
          { file: 'a.ts', symbol: 'a1', viaSymbol: 'zeta', line: 3, rank: 0 },
          { file: 'c.ts', symbol: 'c', viaSymbol: 'beta', line: 1, rank: 0 },
          { file: 'd.ts', symbol: 'd', viaSymbol: 'alpha', line: 1, rank: 0 },
        ],
        impactedEndpoints: [],
      },
      null,
    );
    expect(b.downstream.map((g) => g.symbol)).toEqual(['zeta', 'alpha', 'beta']);
    expect(b.downstream[0]!.callers.map((c) => `${c.file}:${c.line}`)).toEqual([
      'a.ts:3',
      'a.ts:20',
      'b.ts:9',
    ]);
  });

  it('keeps a zero-caller symbol in changed_symbols and counts only (D4)', () => {
    const b = toBlastRadius(facade(), FULL);
    const withExtra = toBlastRadius(
      facade({
        changedSymbols: [
          ...facade().changedSymbols,
          { file: 'src/ctx.ts', name: 'unused', kind: 'function' },
        ],
      }),
      FULL,
    );
    expect(withExtra.changed_symbols.map((s) => s.name)).toContain('unused');
    expect(withExtra.counts.symbols).toBe(3);
    expect(withExtra.downstream.map((g) => g.symbol)).toEqual(b.downstream.map((g) => g.symbol));
  });

  it('passes degraded / reason / index state through; no factsByFile → empty arrays', () => {
    const b = toBlastRadius(
      facade({ factsByFile: undefined, degraded: true, reason: 'no_data' }),
      { status: 'partial', lastIndexedSha: '' },
    );
    expect(b.degraded).toBe(true);
    expect(b.reason).toBe('no_data');
    expect(b.index_status).toBe('partial');
    expect(b.indexed_sha).toBeNull();
    for (const g of b.downstream) {
      expect(g.endpoints_affected).toEqual([]);
      expect(g.crons_affected).toEqual([]);
      for (const c of g.callers) {
        expect(c.endpoints).toEqual([]);
        expect(c.crons).toEqual([]);
      }
    }
    expect(b.counts.endpoints).toBe(0);
    expect(BlastRadius.parse(b)).toEqual(b);

    const ok = toBlastRadius(facade(), FULL);
    expect(ok.degraded).toBe(false);
    expect(ok.reason).toBeNull();
    expect(ok.index_status).toBe('full');
    expect(ok.indexed_sha).toBe('sha-idx');
  });

  it('empty facade → empty downstream and the no-callers summary', () => {
    const b = toBlastRadius(
      { changedSymbols: [], callers: [], impactedEndpoints: [], degraded: true, reason: 'no_data' },
      null,
    );
    expect(b.downstream).toEqual([]);
    expect(b.changed_symbols).toEqual([]);
    expect(b.counts).toEqual({ symbols: 0, callers: 0, endpoints: 0, crons: 0 });
    expect(b.summary).toBe('0 symbols changed · no downstream callers');
    expect(b.index_status).toBeNull();
    expect(BlastRadius.parse(b)).toEqual(b);
  });
});

describe('summarize', () => {
  it('uses singular forms for 1', () => {
    expect(summarize({ symbols: 1, callers: 1, endpoints: 1, crons: 1 })).toBe(
      '1 symbol changed · 1 caller · 1 endpoint · 1 cron',
    );
    expect(summarize({ symbols: 1, callers: 0, endpoints: 0, crons: 0 })).toBe(
      '1 symbol changed · no downstream callers',
    );
    expect(summarize({ symbols: 2, callers: 14, endpoints: 3, crons: 0 })).toBe(
      '2 symbols changed · 14 callers · 3 endpoints · 0 crons',
    );
  });
});
