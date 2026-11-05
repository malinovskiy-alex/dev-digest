/** Tailwind class strings for the pull-frequency hint (L08 skill-stats). */

/**
 * The hint's line is always reserved (F-19): `visibility` never changes layout,
 * so showing or hiding the hint leaves the card's height — and with it the grid
 * row and the rail below — exactly where it was. The box is in the card's flow,
 * directly under the badge row, so it never covers the description and is never
 * clipped by the editor rail's `overflow: auto` (F-18). The top padding sits
 * inside the element, not as a margin, so the pointer crosses no dead gap from
 * the badge down to the hint.
 */
const RESERVED = "invisible block pt-1.5";

export const cx = {
  /**
   * Visible only while the pull-frequency badge is hovered
   * (`[data-pull-freq-badge]`, set by `PullFreqBadge`), while the hint itself is
   * hovered (WCAG 1.4.13 hoverable — an `invisible` box takes no pointer events,
   * so it can only be hovered once the badge has revealed it) and while the card
   * root holds keyboard focus (`group-focus-visible`; the card root carries `group`).
   */
  hint: `${RESERVED} hover:visible group-focus-visible:visible group-has-[[data-pull-freq-badge]:hover]:visible`,
  /** The visible box inside the hint. */
  box: "block rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-[12px] font-normal leading-snug text-[var(--text-secondary)] shadow-md",
  /** Escape pressed: invisible until the pointer or focus leaves the card — its line stays reserved. */
  dismissed: RESERVED,
  /** Pull frequency not `ready` (loading / failed, F-20): the line is held, the hint never shows. */
  reserved: RESERVED,
} as const;
