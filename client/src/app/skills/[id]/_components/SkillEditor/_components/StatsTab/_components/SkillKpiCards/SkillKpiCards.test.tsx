import { describe, it, expect, afterEach } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { EMPTY_FINDINGS, renderWithSkillsIntl, skillStatsReport } from "@/test/agent-performance-fixtures";
import { SkillKpiCards } from "./SkillKpiCards";

afterEach(cleanup);

const SENTENCE = "the last 30 days";

function card(title: string): HTMLElement {
  return screen.getByRole("heading", { name: title }).parentElement!;
}

describe("SkillKpiCards (L08 skill-stats C5)", () => {
  it("shows Used by, Pull frequency, Accept rate and Findings (R-35 … R-37, R-39, R-41)", () => {
    renderWithSkillsIntl(<SkillKpiCards report={skillStatsReport()} rangeSentence={SENTENCE} />);
    expect(within(card("Used by")).getByText("2 agents")).toBeInTheDocument();
    expect(within(card("Used by")).getByText("1 ran in period")).toBeInTheDocument();
    expect(within(card("Pull frequency")).getByText("100% (2/2 PRs)")).toBeInTheDocument();
    expect(within(card("Pull frequency")).getByText("PRs reviewed in the period")).toBeInTheDocument();
    const accept = card("Accept rate");
    expect(within(accept).getByText("80%")).toBeInTheDocument();
    expect(within(accept).getByText("8/10 decisions")).toBeInTheDocument();
    expect(within(accept).queryByText("Small sample")).not.toBeInTheDocument();
    expect(within(card("Findings")).getByText("13")).toBeInTheDocument();
  });

  it("says '1 agent', dashes an unknown pull frequency and an undecided accept rate — never 0% (R-36, R-38, R-39, R-49)", () => {
    renderWithSkillsIntl(
      <SkillKpiCards
        report={skillStatsReport({
          used_by: 1,
          ran_in_period: 0,
          pull_frequency: { prs_with_skill: 0, prs_reviewed: 0, rate: null },
          figures: { accepted: 0, dismissed: 0, pending: 0, decided: 0, accept_rate: null },
          findings: EMPTY_FINDINGS,
        })}
        rangeSentence={SENTENCE}
      />,
    );
    expect(within(card("Used by")).getByText("1 agent")).toBeInTheDocument();
    expect(within(card("Used by")).getByText("0 ran in period")).toBeInTheDocument();
    const pf = card("Pull frequency");
    expect(within(pf).getByText("—")).toBeInTheDocument();
    expect(within(pf).getByText("No reviewed PRs in the last 30 days")).toBeInTheDocument();
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
    const accept = card("Accept rate");
    expect(within(accept).getByText("—")).toBeInTheDocument();
    expect(within(accept).getByText("No decided findings")).toBeInTheDocument();
    expect(within(accept).queryByText("Small sample")).not.toBeInTheDocument();
    expect(within(card("Findings")).getByText("0")).toBeInTheDocument();
  });

  it("flags a small decided sample (R-40, D-12)", () => {
    renderWithSkillsIntl(
      <SkillKpiCards
        report={skillStatsReport({ figures: { accepted: 3, dismissed: 1, pending: 0, decided: 4, accept_rate: 0.75 } })}
        rangeSentence={SENTENCE}
      />,
    );
    const accept = card("Accept rate");
    expect(within(accept).getByText("75%")).toBeInTheDocument();
    expect(within(accept).getByText("3/4 decisions")).toBeInTheDocument();
    expect(within(accept).getByText("Small sample")).toBeInTheDocument();
  });
});
