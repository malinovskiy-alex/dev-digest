/** Pure helpers for a tour file row. */
import { githubBlobUrl } from "@/lib/github-urls";

/** The GitHub link at the tour's revision, or `null` without one (AC-37). */
export function fileHref(repoFullName: string, revision: string | null, path: string): string | null {
  return revision ? githubBlobUrl(repoFullName, revision, path) : null;
}
