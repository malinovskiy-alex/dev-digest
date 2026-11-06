import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import type { Skill } from "@devdigest/shared";
import { renderWithSkillsIntl } from "@/test/agent-performance-fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/skills/s1",
  useSearchParams: () => new URLSearchParams("tab=stats"),
}));
// The Stats tab's data boundary: still loading, so the tab shows its shell.
vi.mock("@/lib/hooks/skill-stats", () => ({
  useSkillStats: () => ({ data: undefined, isError: false, error: null, refetch: vi.fn() }),
}));

import { SkillEditor } from "./SkillEditor";

afterEach(cleanup);

const SKILL: Skill = {
  id: "s1",
  name: "OWASP Top 10",
  description: "",
  type: "security",
  source: "manual",
  body: "",
  enabled: true,
  version: 1,
  agent_count: 2,
};

describe("SkillEditor tabs (L08 skill-stats C10, R-34)", () => {
  it("orders the tabs Config, Preview, Stats, Versions, Context and renders Stats on ?tab=stats", async () => {
    const onTab = vi.fn();
    renderWithSkillsIntl(<SkillEditor skill={SKILL} tab="stats" onTab={onTab} />);
    const names = screen.getAllByRole("button").map((b) => b.textContent?.trim());
    const tabs = ["Config", "Preview", "Stats", "Versioning", "Context"];
    expect(names.filter((n) => tabs.includes(n ?? ""))).toEqual(tabs);
    // The tab's code is loaded on demand (F-09).
    expect(await screen.findByRole("heading", { name: "Stats" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Range" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Versioning" }));
    expect(onTab).toHaveBeenCalledWith("versions");
  });
});
