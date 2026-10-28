import type { BlastCaller, BlastCounts, BlastRadius, DownstreamImpact } from '@devdigest/shared';
import type { BlastFacadeCaller, BlastFacadeResult, BlastIndexView } from './types.js';

/**
 * blast — pure mapping from the repo-intel facade result to the `BlastRadius`
 * contract (Ring 1: no I/O, no async, no model).
 *
 * Ordering is decided HERE, on the server, so the tree, the graph and the MCP
 * tool all agree (D5): groups by top caller rank desc → caller count desc →
 * symbol asc; callers by rank desc → file → line.
 */

const NO_FACTS: { endpoints: string[]; crons: string[] } = { endpoints: [], crons: [] };

/** Code-unit string order — deterministic regardless of locale. */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function uniqSorted(xs: Iterable<string>): string[] {
  return [...new Set(xs)].sort(cmp);
}

function compareCallers(a: BlastFacadeCaller, b: BlastFacadeCaller): number {
  return b.rank - a.rank || cmp(a.file, b.file) || a.line - b.line;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Deterministic English summary of the counts (no model, P2.4). */
export function summarize(counts: BlastCounts): string {
  const symbols = `${plural(counts.symbols, 'symbol', 'symbols')} changed`;
  if (counts.callers === 0) return `${symbols} · no downstream callers`;
  return [
    symbols,
    plural(counts.callers, 'caller', 'callers'),
    plural(counts.endpoints, 'endpoint', 'endpoints'),
    plural(counts.crons, 'cron', 'crons'),
  ].join(' · ');
}

export function toBlastRadius(
  facade: BlastFacadeResult,
  index: BlastIndexView | null,
): BlastRadius {
  // 1. Which files declare each changed symbol.
  const declFiles = new Map<string, Set<string>>();
  for (const s of facade.changedSymbols) {
    const set = declFiles.get(s.name);
    if (set) set.add(s.file);
    else declFiles.set(s.name, new Set([s.file]));
  }

  const facts = (file: string) => facade.factsByFile?.[file] ?? NO_FACTS;

  // 2–3. Drop callers living in a file that declares the symbol they reach
  // (P2.5 — the persistent path keeps same-file references), then group.
  const groups = new Map<string, BlastFacadeCaller[]>();
  for (const c of facade.callers) {
    if (declFiles.get(c.viaSymbol)?.has(c.file)) continue;
    const arr = groups.get(c.viaSymbol);
    if (arr) arr.push(c);
    else groups.set(c.viaSymbol, [c]);
  }

  // 5. Order groups (D5); only symbols with ≥1 caller reach `downstream` (D4).
  const ordered = [...groups.entries()]
    .map(([symbol, callers]) => {
      const sorted = [...callers].sort(compareCallers);
      return { symbol, topRank: sorted[0]?.rank ?? 0, callers: sorted };
    })
    .sort(
      (a, b) =>
        b.topRank - a.topRank ||
        b.callers.length - a.callers.length ||
        cmp(a.symbol, b.symbol),
    );

  // 3–4. Per caller its own file's facts (D13); per group the union, crons apart.
  const downstream: DownstreamImpact[] = ordered.map((g) => {
    const callers: BlastCaller[] = g.callers.map((c) => {
      const f = facts(c.file);
      return {
        name: c.symbol,
        file: c.file,
        line: c.line,
        endpoints: uniqSorted(f.endpoints),
        crons: uniqSorted(f.crons),
      };
    });
    return {
      symbol: g.symbol,
      callers,
      endpoints_affected: uniqSorted(callers.flatMap((c) => c.endpoints)),
      crons_affected: uniqSorted(callers.flatMap((c) => c.crons)),
    };
  });

  // 6. Counts from `downstream` itself (D6): a number above a list is counted from that list.
  const counts: BlastCounts = {
    symbols: facade.changedSymbols.length,
    callers: downstream.reduce((n, g) => n + g.callers.length, 0),
    endpoints: new Set(downstream.flatMap((g) => g.endpoints_affected)).size,
    crons: new Set(downstream.flatMap((g) => g.crons_affected)).size,
  };

  // 7.
  return {
    changed_symbols: facade.changedSymbols.map((s) => ({
      name: s.name,
      file: s.file,
      kind: s.kind,
    })),
    downstream,
    summary: summarize(counts),
    counts,
    degraded: facade.degraded ?? false,
    reason: facade.reason ?? null,
    index_status: index?.status ?? null,
    indexed_sha: index?.lastIndexedSha || null,
  };
}
