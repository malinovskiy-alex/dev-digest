/** Pure helpers for the "On this page" list. */

/**
 * The active entry: the section whose heading `top` is closest to 0 (the top
 * of the viewport), ties to the earlier one (AC-81). `null` for no sections.
 */
export function activeSection(tops: Array<{ id: string; top: number }>): string | null {
  let best: { id: string; top: number } | null = null;
  for (const t of tops) {
    if (!best || Math.abs(t.top) < Math.abs(best.top)) best = t;
  }
  return best?.id ?? null;
}
