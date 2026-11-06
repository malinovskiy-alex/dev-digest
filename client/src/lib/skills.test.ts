import { describe, it, expect } from "vitest";
import { skillEditorHref } from "./skills";

describe("skillEditorHref (L08 skill-stats R-29, R-53)", () => {
  it("sets the tab and keeps every other key of the address — the range among them", () => {
    const href = skillEditorHref("s2", "stats", new URLSearchParams("tab=config&range=custom&start=2026-11-01&end=2026-11-03"));
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/skills/s2");
    expect(url.searchParams.get("tab")).toBe("stats");
    expect(url.searchParams.get("range")).toBe("custom");
    expect(url.searchParams.get("start")).toBe("2026-11-01");
    expect(url.searchParams.get("end")).toBe("2026-11-03");

    expect(skillEditorHref("a b", "config", new URLSearchParams(""))).toBe("/skills/a%20b?tab=config");
  });
});
