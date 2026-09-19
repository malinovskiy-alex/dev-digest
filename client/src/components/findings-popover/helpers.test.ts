/**
 * panelPosition — where the panel goes AND how big it is allowed to be.
 *
 * The size half is the part worth guarding. A panel drawn at its design size
 * leaves the viewport in two ways that no amount of scrolling recovers from:
 * flipped up with too little room above, its first rows sit at a negative
 * `top`; on a phone it is simply wider than the screen. Both are silent — the
 * panel renders, it just cannot be read.
 */
import { describe, it, expect, afterEach } from "vitest";
import { panelPosition, bySeverity } from "./helpers";
import { PANEL_MAX_HEIGHT, PANEL_WIDTH } from "./constants";
import type { FindingRecord } from "@devdigest/shared";

const REAL = { w: window.innerWidth, h: window.innerHeight };

function viewport(w: number, h: number) {
  Object.defineProperty(window, "innerWidth", { value: w, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: h, configurable: true });
}
afterEach(() => viewport(REAL.w, REAL.h));

/** A trigger rect: DOMRect is not constructible with values in jsdom. */
const rect = (left: number, top: number, height = 20): DOMRect =>
  ({ left, top, bottom: top + height, right: left + 80, width: 80, height }) as DOMRect;

describe("panelPosition", () => {
  it("drops below the trigger when there is room, at full size", () => {
    viewport(1440, 900);
    const p = panelPosition(rect(300, 200));
    expect(p.top).toBe(228);
    expect(p.bottom).toBeUndefined();
    expect(p.width).toBe(PANEL_WIDTH);
    expect(p.maxHeight).toBe(PANEL_MAX_HEIGHT);
  });

  it("never lets a flipped-up panel start above the viewport", () => {
    // 500px tall, trigger at y=300: below has 160px, above has 280px — it
    // flips, and the 380px design height would then start at top: -88.
    viewport(1440, 500);
    const p = panelPosition(rect(300, 300));
    expect(p.top).toBeUndefined();
    expect(p.bottom).toBe(208);
    expect(p.maxHeight).toBe(280);
    expect(500 - p.bottom! - p.maxHeight).toBe(12); // exactly the margin
  });

  it("stays below and shortens when below is tight but still the roomier side", () => {
    // Flipping here would show LESS of the panel, so it must not flip.
    viewport(1440, 700);
    const p = panelPosition(rect(300, 300));
    expect(p.top).toBe(328);
    expect(p.maxHeight).toBe(360);
    expect(p.maxHeight).toBeLessThan(PANEL_MAX_HEIGHT);
  });

  it("fits the width to a phone instead of running off the right edge", () => {
    viewport(375, 812);
    const p = panelPosition(rect(300, 200));
    expect(p.width).toBe(375 - 24);
    expect(p.left).toBeGreaterThanOrEqual(12);
    expect(p.left + p.width).toBeLessThanOrEqual(375 - 12);
  });

  it("keeps the panel off the left edge for a trigger at x=0", () => {
    viewport(1440, 900);
    expect(panelPosition(rect(0, 200)).left).toBe(12);
  });
});

describe("bySeverity", () => {
  const f = (id: string, severity: string) => ({ id, severity }) as FindingRecord;

  it("puts the worst first, so a truncated preview keeps what matters", () => {
    const sorted = bySeverity([f("a", "SUGGESTION"), f("b", "CRITICAL"), f("c", "WARNING")]);
    expect(sorted.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("does not reorder the caller's array", () => {
    const input = [f("a", "SUGGESTION"), f("b", "CRITICAL")];
    bySeverity(input);
    expect(input.map((x) => x.id)).toEqual(["a", "b"]);
  });
});
