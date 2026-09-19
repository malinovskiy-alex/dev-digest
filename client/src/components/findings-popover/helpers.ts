import type { FindingRecord } from "@devdigest/shared";
import { SEVERITY_DISPLAY_ORDER } from "@/components/severity-chips";
import { PANEL_GAP, PANEL_MAX_HEIGHT, PANEL_WIDTH, VIEWPORT_MARGIN } from "./constants";

/** Worst first, so a truncated preview keeps the findings that matter. */
export function bySeverity(findings: FindingRecord[]): FindingRecord[] {
  const weight = (s: string) => {
    const i = SEVERITY_DISPLAY_ORDER.indexOf(s as never);
    return i === -1 ? SEVERITY_DISPLAY_ORDER.length : i;
  };
  return [...findings].sort((a, b) => weight(a.severity) - weight(b.severity));
}

/**
 * Place and SIZE the panel against its trigger, in viewport coordinates.
 *
 * `position: fixed` rather than absolute because both callers sit inside a card
 * with `overflow: hidden`, which clips absolutely-positioned descendants but not
 * fixed ones. That holds only while no ancestor establishes a containing block
 * via transform / filter / perspective / will-change / contain — none do today.
 * Add one (a page transition, say) and this silently starts being clipped.
 *
 * Size comes back with the position because the two cannot be decided apart.
 * A panel drawn at its design size would leave the viewport in two ways:
 *
 *  - Vertically, if it flips up with less than `PANEL_MAX_HEIGHT` of room
 *    above. The panel scrolls its own overflow, but nothing can scroll it back
 *    down into view, so its first rows — the worst findings, since `bySeverity`
 *    sorts CRITICAL first — would be unreachable. `maxHeight` is therefore the
 *    room actually available on the side that was chosen.
 *  - Horizontally, on anything narrower than `PANEL_WIDTH + 2 * VIEWPORT_MARGIN`
 *    (404px — every common phone). Clamping `left` cannot help: the panel is
 *    simply wider than the screen. `width` shrinks to fit instead.
 */
export function panelPosition(anchor: DOMRect): {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
} {
  const viewportH = typeof window === "undefined" ? 0 : window.innerHeight;
  const viewportW = typeof window === "undefined" ? 0 : window.innerWidth;

  // No viewport to measure (SSR / jsdom before layout) — fall back to the
  // design size rather than collapsing the panel to nothing.
  const width = viewportW > 0 ? Math.min(PANEL_WIDTH, viewportW - 2 * VIEWPORT_MARGIN) : PANEL_WIDTH;

  const roomBelow = viewportH - anchor.bottom - PANEL_GAP - VIEWPORT_MARGIN;
  const roomAbove = anchor.top - PANEL_GAP - VIEWPORT_MARGIN;
  // Flip up only when the panel cannot be drawn in full below AND above is the
  // roomier side — otherwise a trigger near the middle would flip for nothing.
  const flipUp = roomBelow < PANEL_MAX_HEIGHT && roomAbove > roomBelow;
  const maxHeight = Math.max(0, Math.min(PANEL_MAX_HEIGHT, flipUp ? roomAbove : roomBelow));

  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(anchor.left - PANEL_GAP, viewportW - width - VIEWPORT_MARGIN),
  );
  return flipUp
    ? { bottom: viewportH - anchor.top + PANEL_GAP, left, width, maxHeight }
    : { top: anchor.bottom + PANEL_GAP, left, width, maxHeight };
}
