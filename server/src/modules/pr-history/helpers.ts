import type { PrHistory, PrHistoryItem } from '@devdigest/shared';
import type { MergedPull } from './types.js';

/**
 * pr-history — pure mapping (Ring 1). Keeps the merged PRs whose files overlap
 * the current PR's, newest update first.
 */

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function toPrHistory(
  currentPaths: string[],
  checked: { pull: MergedPull; paths: string[] }[],
  meta: { candidates: number; unchecked: number; githubUnavailable: boolean },
): PrHistory {
  const current = new Set(currentPaths);

  const kept = checked
    .map(({ pull, paths }) => ({
      pull,
      overlap: [...new Set(paths.filter((p) => current.has(p)))].sort(cmp),
    }))
    .filter((x) => x.overlap.length > 0)
    .sort(
      (a, b) =>
        (b.pull.updatedAt?.getTime() ?? 0) - (a.pull.updatedAt?.getTime() ?? 0) ||
        b.pull.number - a.pull.number,
    );

  const history: PrHistoryItem[] = kept.map(({ pull, overlap }) => ({
    pr_number: pull.number,
    title: pull.title,
    // D14b — the merged PR's last update, not a merge timestamp (none is stored).
    merged_at: pull.updatedAt?.toISOString() ?? '',
    author: pull.author,
    files_overlap: overlap,
    notes: `${overlap.length} shared file${overlap.length === 1 ? '' : 's'}`,
  }));

  return {
    history,
    candidates: meta.candidates,
    unchecked: meta.unchecked,
    github_unavailable: meta.githubUnavailable,
  };
}
