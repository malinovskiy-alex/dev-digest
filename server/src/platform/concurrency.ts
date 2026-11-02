/**
 * Bounded concurrency — pure (Ring 1): no I/O, no imports. The one copy of a
 * helper three modules had written for themselves (brief, project-context,
 * onboarding — L05 F-25).
 */

/**
 * `Promise.all(items.map(fn))` with at most `limit` calls in flight; results
 * keep input order. Rejects with the first rejection, like `Promise.all`.
 */
export async function mapBounded<I, O>(items: I[], limit: number, fn: (item: I) => Promise<O>): Promise<O[]> {
  const out = new Array<O>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
  return out;
}
