import { describe, it, expect } from "vitest";
import { CHARS_PER_TOKEN, estimateTokens } from "./tokens";

describe("estimateTokens", () => {
  it("is ceil(chars / 4) — the same rule the server uses for approx_tokens", () => {
    expect(CHARS_PER_TOKEN).toBe(4);
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(estimateTokens("x".repeat(32_000))).toBe(8_000);
  });
});
