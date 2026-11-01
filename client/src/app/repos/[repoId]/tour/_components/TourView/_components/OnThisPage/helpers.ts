/** Pure helpers for the "On this page" list. */

/** Pixels from the end of the scroll range that still count as "scrolled to the end". */
const END_SLACK_PX = 2;

/**
 * The active entry: the section whose heading `top` is closest to 0 (the top
 * of the scroll container), ties to the earlier one (AC-81). Once the
 * container is scrolled to its end, the last section is active: a short last
 * section can never bring its heading to the top, and would otherwise never
 * become current (F-38). `null` for no sections.
 */
export function activeSection(tops: Array<{ id: string; top: number }>, atEnd = false): string | null {
  if (atEnd && tops.length > 0) return tops[tops.length - 1]!.id;
  let best: { id: string; top: number } | null = null;
  for (const t of tops) {
    if (!best || Math.abs(t.top) < Math.abs(best.top)) best = t;
  }
  return best?.id ?? null;
}

/** Whether a scroll range is at its end (and actually scrolls). */
export function scrolledToEnd(scrollTop: number, clientHeight: number, scrollHeight: number): boolean {
  return scrollHeight > clientHeight && scrollTop + clientHeight >= scrollHeight - END_SLACK_PX;
}
