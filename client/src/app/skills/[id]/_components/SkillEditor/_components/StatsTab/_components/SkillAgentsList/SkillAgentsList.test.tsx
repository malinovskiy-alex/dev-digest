import { describe, it, expect, afterEach } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithSkillsIntl, skillStatsReport } from "@/test/agent-performance-fixtures";
import { SkillAgentsList } from "./SkillAgentsList";

afterEach(cleanup);

const APPLIED = { from: new Date("2026-10-06T12:00:00.000Z"), to: new Date("2026-11-05T12:00:00.000Z") };
const THIRTY = { kind: "preset", preset: "30d", at: null } as const;

describe("SkillAgentsList (L08 skill-stats C6)", () => {
  it("lists the agents in the order received with runs, a Disabled badge and an 'Open <name>' link to the agent's Stats tab (R-42 … R-45, R-80)", () => {
    renderWithSkillsIntl(<SkillAgentsList agents={skillStatsReport().agents} choice={THIRTY} applied={APPLIED} />);
    expect(screen.getByRole("heading", { name: "Agents using this skill" })).toBeInTheDocument();

    const rows = screen.getAllByRole("listitem");
    expect(rows.map((r) => within(r).getByRole("link").getAttribute("aria-label"))).toEqual([
      "Open Security Reviewer",
      "Open Test Quality Reviewer",
    ]);
    expect(within(rows[0]!).getByText("1 run")).toBeInTheDocument();
    expect(within(rows[0]!).queryByText("Disabled")).not.toBeInTheDocument();
    expect(within(rows[1]!).getByText("0 runs")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Disabled")).toBeInTheDocument();

    const links = screen.getAllByRole("link", { name: /^Open / });
    expect(links[0]).toHaveTextContent("Open");
    // A preset pins its end to the applied end, so the agent tab shows the same window (R-43, D-13).
    expect(links[0]).toHaveAttribute("href", `/agents/a1?tab=stats&range=30d&at=${encodeURIComponent(APPLIED.to.toISOString())}`);
  });

  it("carries a custom range's dates on the link", () => {
    renderWithSkillsIntl(
      <SkillAgentsList
        agents={skillStatsReport().agents}
        choice={{ kind: "custom", start: "2026-11-01", end: "2026-11-03" }}
        applied={APPLIED}
      />,
    );
    expect(screen.getByRole("link", { name: "Open Security Reviewer" })).toHaveAttribute(
      "href",
      "/agents/a1?tab=stats&range=custom&start=2026-11-01&end=2026-11-03",
    );
  });

  it("says no agent uses the skill, and where to attach it (R-46)", () => {
    renderWithSkillsIntl(<SkillAgentsList agents={[]} choice={THIRTY} applied={APPLIED} />);
    expect(screen.getByText("No agent uses this skill")).toBeInTheDocument();
    expect(screen.getByText("Attach it on an agent's Skills tab")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
