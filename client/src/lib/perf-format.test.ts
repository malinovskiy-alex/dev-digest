import { describe, it, expect } from "vitest";
import {
  ACCEPT_BAND_COLOR,
  acceptBand,
  acceptPercent,
  ratePercent,
  formatCostDelta,
  formatDurationSec,
  isCostUnchanged,
  isSmallSample,
  segmentLabel,
} from "./perf-format";

describe("perf-format", () => {
  it("formats durations, percents and the small-sample flag (R-54, R-61)", () => {
    expect(formatDurationSec(6234)).toBe("6.2s");
    expect(formatDurationSec(null)).toBe("—");
    expect(acceptPercent(0.674)).toBe(67);
    expect(acceptPercent(null)).toBeNull();
    // ratePercent is the same rule for the skill pull frequency (L08 skill-stats F-12).
    expect(ratePercent(1 / 3)).toBe(33);
    expect(ratePercent(Number.NaN)).toBeNull();
    expect(ratePercent(null)).toBeNull();
    expect(isSmallSample(4)).toBe(true);
    expect(isSmallSample(5)).toBe(false);
    expect(isSmallSample(0)).toBe(false);
  });

  it("bands on the displayed percent, neutral on a small sample or unknown rate (R-100, R-101)", () => {
    expect(acceptBand(0.7, 10)).toBe("good");
    expect(acceptBand(0.695, 10)).toBe("good"); // displayed 70
    expect(acceptBand(0.69, 10)).toBe("warn");
    expect(acceptBand(0.5, 10)).toBe("warn");
    expect(acceptBand(0.49, 10)).toBe("bad");
    expect(acceptBand(0.9, 4)).toBe("neutral");
    expect(acceptBand(null, 0)).toBe("neutral");
    expect(ACCEPT_BAND_COLOR.neutral).toBe("var(--text-secondary)");
  });

  it("signs a known cost delta and never invents one (R-94, R-95)", () => {
    expect(formatCostDelta(0.12)).toBe("+$0.120");
    expect(formatCostDelta(-1.2)).toBe("−$1.200");
    expect(formatCostDelta(null)).toBeNull();
  });

  it("treats exact zero and float noise below display precision as no change, never a signed '<$0.0001' (F-11)", () => {
    expect(isCostUnchanged(0)).toBe(true);
    expect(isCostUnchanged(0.1 + 0.2 - 0.3)).toBe(true);
    expect(isCostUnchanged(-0.00009)).toBe(true);
    expect(isCostUnchanged(0.0001)).toBe(false);
    expect(isCostUnchanged(null)).toBe(false);
    expect(formatCostDelta(0)).toBeNull();
    expect(formatCostDelta(0.1 + 0.2 - 0.3)).toBeNull();
    expect(formatCostDelta(0.0001)).toBe("+$0.0001");
  });

  it("labels model segments, qualifying a model id seen under two providers (D-6)", () => {
    const all = [
      { provider: "openai", model: "gpt-4.1" },
      { provider: "azure", model: "gpt-4.1" },
      { provider: "anthropic", model: "claude" },
      { provider: null, model: null },
    ];
    expect(segmentLabel(all[0]!, all, "Unknown model")).toBe("openai/gpt-4.1");
    expect(segmentLabel(all[2]!, all, "Unknown model")).toBe("claude");
    expect(segmentLabel(all[3]!, all, "Unknown model")).toBe("Unknown model");
  });
});
