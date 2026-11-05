import { describe, it, expect, afterEach } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import { renderWithPerfIntl, report } from "@/test/agent-performance-fixtures";
import { DELETED_AGENT_COLOR } from "@/lib/perf-colors";
import { CostBreakdown } from "./CostBreakdown";

afterEach(cleanup);

describe("CostBreakdown", () => {
  it("lists both legends by amount with names and house-format amounts (R-66, R-67, R-69, R-87)", () => {
    const r = report({
      cost_by_agent: [
        { kind: "agent", agent_id: "a1", agent_name: "Security Reviewer", runs: 10, cost_usd: 0.4 },
        { kind: "deleted", agent_id: null, agent_name: null, runs: 2, cost_usd: 0.1 },
      ],
      cost_by_model: [
        { provider: "openai", model: "gpt-4.1", runs: 10, cost_usd: 0.4 },
        { provider: null, model: null, runs: 2, cost_usd: 0.1 },
      ],
    });
    renderWithPerfIntl(<CostBreakdown report={r} />);
    expect(screen.getByRole("heading", { name: "Cost breakdown · DevDigest estimate" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Cost by agent" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Cost by model" })).toBeInTheDocument();

    const [byAgent, byModel] = screen.getAllByRole("list");
    const agentItems = within(byAgent!).getAllByRole("listitem");
    expect(agentItems.map((li) => li.textContent)).toEqual(["Security Reviewer$0.400", "Deleted agents$0.100"]);
    // The deleted segment is neutral (R-103).
    expect((agentItems[1]!.firstElementChild as HTMLElement).style.background).toBe(DELETED_AGENT_COLOR);
    expect(within(byModel!).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "gpt-4.1$0.400",
      "Unknown model$0.100",
    ]);
  });

  it("shows one message instead of both charts when nothing is priced (R-68)", () => {
    renderWithPerfIntl(<CostBreakdown report={report({ cost_by_agent: [], cost_by_model: [] })} />);
    expect(screen.getByText("No priced runs in this period")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
