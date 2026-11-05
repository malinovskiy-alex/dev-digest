import { describe, it, expect } from "vitest";
import { toCardPullFreq, type PullFreqQueryState } from "./helpers";

const DATA: PullFreqQueryState["data"] = new Map([
  ["s1", { rate: 0.5 }],
  ["s2", { rate: null }],
]);

describe("toCardPullFreq", () => {
  it("is loading until the first read lands", () => {
    expect(toCardPullFreq({ isPending: true, isError: false }, "s1")).toEqual({ status: "loading" });
  });

  it("is ready with the skill's rate, null included", () => {
    const q = { isPending: false, isError: false, data: DATA };
    expect(toCardPullFreq(q, "s1")).toEqual({ status: "ready", rate: 0.5 });
    expect(toCardPullFreq(q, "s2")).toEqual({ status: "ready", rate: null });
  });

  it("errors only when the read failed and nothing is cached", () => {
    expect(toCardPullFreq({ isPending: false, isError: true }, "s1")).toEqual({ status: "error" });
  });

  it("keeps the cached figure when a background refetch fails (F-24)", () => {
    expect(toCardPullFreq({ isPending: false, isError: true, data: DATA }, "s1")).toEqual({
      status: "ready",
      rate: 0.5,
    });
  });

  it("gives a skill the read does not list a value, never undefined, so its card reserves the hint line (F-20)", () => {
    expect(toCardPullFreq({ isPending: false, isError: false, data: DATA }, "new")).toEqual({ status: "error" });
    expect(toCardPullFreq({ isPending: false, isError: true, data: DATA }, "new")).toEqual({ status: "error" });
  });
});
