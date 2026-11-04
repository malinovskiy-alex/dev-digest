/**
 * PrBriefCard helpers — `formatTokensK` (R-91, BD-6): thousands with one
 * decimal and no grouping separator. Expected values are the requirement's
 * (8,200 → 8.2, 400 → 0.4) and the plan's BD-6 table.
 */
import { describe, it, expect } from "vitest";
import { formatTokensK } from "./helpers";

describe("formatTokensK (R-91, BD-6)", () => {
  it.each([
    [8200, "8.2"],
    [400, "0.4"],
    [420, "0.4"],
    [1250, "1.3"],
    [0, "0.0"],
    [3100, "3.1"],
    [1300, "1.3"],
  ])("%i → %s", (n, expected) => {
    expect(formatTokensK(n)).toBe(expected);
  });

  it("large counts keep one decimal and no grouping separator", () => {
    expect(formatTokensK(1_234_567)).toBe("1234.6");
  });
});
