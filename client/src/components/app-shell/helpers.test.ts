/**
 * The sidebar entry and active key for the Onboarding Tour (plan step 31:
 * AC-01, AC-02, AC-04, AC-05).
 */
import { describe, it, expect } from "vitest";
import { NAV, resolveHref } from "@devdigest/ui";
import { activeKeyFor } from "./helpers";

describe("Onboarding Tour in the sidebar", () => {
  it("AC-01 — WORKSPACE lists Pull Requests, Onboarding Tour, Project Context in that order", () => {
    expect(NAV[0]!.section).toBe("WORKSPACE");
    expect(NAV[0]!.items.map((i) => i.key)).toEqual(["pulls", "onboarding-tour", "context"]);
    const item = NAV[0]!.items.find((i) => i.key === "onboarding-tour")!;
    expect(item.label).toBe("Onboarding Tour");
  });

  it("AC-01, AC-02 — the tour item resolves to /repos/<id>/tour of the active repo", () => {
    const item = NAV[0]!.items.find((i) => i.key === "onboarding-tour")!;
    expect(resolveHref(item.href, "r1")).toBe("/repos/r1/tour");
  });

  it("AC-02, AC-04 — the tour page marks the Onboarding Tour item active", () => {
    expect(activeKeyFor("/repos/r1/tour")).toBe("onboarding-tour");
  });

  it("AC-05 — the add-repository screen does not, and Project Context keeps its own key", () => {
    expect(activeKeyFor("/onboarding")).not.toBe("onboarding-tour");
    expect(activeKeyFor("/repos/r1/context")).toBe("context");
  });
});
