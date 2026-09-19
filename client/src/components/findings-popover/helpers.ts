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
 * Place the panel against its trigger, in viewport coordinates.
 *
 * `position: fixed` rather than absolute because both callers sit inside a card
 * with `overflow: hidden`, which clips absolutely-positioned descendants but not
 * fixed ones. That holds only while no ancestor establishes a containing block
 * via transform / filter / perspective / will-change / contain — none do today.
 * Add one (a page transition, say) and this silently starts being clipped.
 */
export function panelPosition(anchor: DOMRect): {
  top?: number;
  bottom?: number;
  left: number;
} {
  const viewportH = typeof window === "undefined" ? 0 : window.innerHeight;
  const viewportW = typeof window === "undefined" ? 0 : window.innerWidth;
  const flipUp = anchor.bottom + PANEL_MAX_HEIGHT + PANEL_GAP > viewportH;
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(anchor.left - PANEL_GAP, viewportW - PANEL_WIDTH - VIEWPORT_MARGIN),
  );
  return flipUp
    ? { bottom: viewportH - anchor.top + PANEL_GAP, left }
    : { top: anchor.bottom + PANEL_GAP, left };
}
