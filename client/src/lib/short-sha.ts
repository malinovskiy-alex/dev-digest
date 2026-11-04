/** The short form of a commit SHA, shared by the Intent card and the PR Brief header (D-34). */

/** How many characters of a head SHA the "… for abc1234" lines show. */
export const SHORT_SHA_LENGTH = 7;

export function shortSha(sha: string | null | undefined): string | null {
  return sha ? sha.slice(0, SHORT_SHA_LENGTH) : null;
}
