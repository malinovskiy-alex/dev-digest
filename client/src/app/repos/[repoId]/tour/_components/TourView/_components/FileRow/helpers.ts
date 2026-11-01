/** Pure helpers for a tour file row. */
import { githubBlobUrl } from "@/lib/github-urls";

/** Longest path drawn in full; longer ones are middle-truncated (AC-78). */
export const PATH_MAX = 64;

/** The GitHub link at the tour's revision, or `null` without one (AC-37). */
export function fileHref(repoFullName: string, revision: string | null, path: string): string | null {
  return revision ? githubBlobUrl(repoFullName, revision, path) : null;
}
