/** Pure helpers for the Files changed tab. */
import type {
  FindingRecord,
  PrFile,
  ReviewRecord,
  SmartDiff,
  SmartDiffGroup,
} from "@devdigest/shared";

/** One shared empty list, so a memo keyed on the findings stays stable. */
const NO_FINDINGS: FindingRecord[] = [];

/**
 * The findings to render inline: those of the review the server chose as the
 * PR's "latest review" (`smartDiff.review_id`). The server is authoritative —
 * the client never re-derives which review is latest — so the group counters
 * (`finding_lines`) and the inline cards always come from the same review.
 * Returns `[]` while the smart diff is loading, when the PR has no review
 * (`review_id` null), or when `reviews` does not contain that id yet (e.g. a
 * refetch still in flight). If the smart diff FAILED, findings must not vanish
 * with the grouping (D-9): fall back to the newest `kind === "review"` review,
 * the same rule the server applies (`reviews` arrive newest first).
 */
export function inlineFindings(
  reviews: ReviewRecord[] | undefined,
  smartDiff: SmartDiff | undefined,
  smartDiffFailed = false,
): FindingRecord[] {
  if (!smartDiff && smartDiffFailed) {
    return reviews?.find((r) => r.kind === "review")?.findings ?? NO_FINDINGS;
  }
  const reviewId = smartDiff?.review_id;
  if (!reviewId) return NO_FINDINGS;
  return reviews?.find((r) => r.id === reviewId)?.findings ?? NO_FINDINGS;
}

/** File count and summed +/− lines, for the "N files · +A −D" summary. */
export function diffTotals(files: PrFile[]): { files: number; additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const f of files) {
    additions += f.additions;
    deletions += f.deletions;
  }
  return { files: files.length, additions, deletions };
}

/** A Smart Diff group resolved to the full PrFiles (with patches) it names. */
export interface ResolvedGroup {
  group: SmartDiffGroup;
  files: PrFile[];
}

/**
 * Map each Smart Diff group's paths onto the PR's files, keeping GitHub order
 * (the index in `files`) within a group. Returns `null` — "show Original
 * order" — when there is no Smart Diff yet, or when any PR file is missing
 * from every group: a file must never disappear because of the grouping.
 * Smart Diff paths unknown to `files` are dropped.
 */
export function resolveGroups(smartDiff: SmartDiff | undefined, files: PrFile[]): ResolvedGroup[] | null {
  if (!smartDiff) return null;
  const indexOf = new Map(files.map((f, i) => [f.path, i] as const));
  const covered = new Set<string>();
  const resolved = smartDiff.groups.map((group) => {
    const idx = group.files
      .map((f) => indexOf.get(f.path))
      .filter((i): i is number => i !== undefined)
      .sort((a, b) => a - b);
    for (const i of idx) covered.add(files[i]!.path);
    return { group, files: idx.map((i) => files[i]!) };
  });
  if (files.some((f) => !covered.has(f.path))) return null;
  return resolved.filter((g) => g.files.length > 0);
}
