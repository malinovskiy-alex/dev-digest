import { describe, it, expect } from "vitest";
import { AGENT_PALETTE, DELETED_AGENT_COLOR, UNKNOWN_MODEL_COLOR, agentColor, modelColor } from "./perf-colors";

describe("perf-colors (R-102, R-103)", () => {
  it("derives a stable palette colour per agent id and keeps the neutral for the deleted row", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `agent-${i}-${"x".repeat(i)}`);
    for (const id of ids) {
      const c = agentColor(id);
      expect(agentColor(id)).toBe(c);
      expect(AGENT_PALETTE).toContain(c);
      expect(c).not.toBe(DELETED_AGENT_COLOR);
    }
    // The palette spreads: 50 ids do not all land on one colour.
    expect(new Set(ids.map(agentColor)).size).toBeGreaterThan(1);
    expect(agentColor(null)).toBe(DELETED_AGENT_COLOR);
    expect(AGENT_PALETTE).not.toContain(DELETED_AGENT_COLOR);
  });

  it("colours models by provider/model, unknown model neutral", () => {
    expect(AGENT_PALETTE).toContain(modelColor("openai", "gpt-4.1"));
    expect(modelColor("openai", "gpt-4.1")).toBe(modelColor("openai", "gpt-4.1"));
    expect(modelColor("openai", null)).toBe(UNKNOWN_MODEL_COLOR);
  });
});
