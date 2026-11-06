import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import {
  ZERO_FIGURES,
  agentRow,
  comparison,
  deletedRow,
  figures,
  renderWithPerfIntl,
  report,
} from "@/test/agent-performance-fixtures";
import { DELETED_AGENT_COLOR, agentColor } from "@/lib/perf-colors";
import type { PerfRangeChoice } from "@/lib/perf-range";
import { CostBreakdown } from "../CostBreakdown";
import { AgentPerfTable } from "./AgentPerfTable";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const CHOICE: PerfRangeChoice = { kind: "preset", preset: "30d", at: null };
const RANGE = { from: new Date("2026-10-06T12:00:00.000Z"), to: new Date("2026-11-05T12:00:00.000Z") };

const ROWS = [
  agentRow("z", "Zero", { figures: ZERO_FIGURES, comparison: comparison({ accept_trend: null }), cost_by_model: [] }),
  deletedRow(),
  agentRow("c", "Charlie", {
    figures: figures({ accepted: 3, dismissed: 0, decided: 3, accept_rate: 1 }),
    comparison: comparison({ accept_trend: "flat", previous_accept_rate: 1 }),
  }),
  agentRow("b", "Bravo", {
    enabled: false,
    figures: figures({ accepted: 69, dismissed: 31, decided: 100, accept_rate: 0.69 }),
    comparison: comparison({ accept_trend: "down", previous_accept_rate: 0.8 }),
  }),
  agentRow("d", "Delta", { figures: figures({ accepted: 1, dismissed: 3, decided: 4, accept_rate: 0.25 }) }),
  agentRow("a", "Alpha", {
    figures: figures({ accepted: 7, dismissed: 3, decided: 10, accept_rate: 0.7 }),
    comparison: comparison({ accept_trend: "up", previous_accept_rate: 0.6 }),
  }),
];

function order(): string[] {
  return screen
    .getAllByRole("button", { name: /^Details for / })
    .map((b) => b.getAttribute("aria-label")!.replace("Details for ", ""));
}

function rowOf(name: string): HTMLElement {
  return screen.getByRole("button", { name: `Details for ${name}` }).closest("tr")!;
}

function header(name: RegExp): HTMLElement {
  return screen.getByRole("columnheader", { name });
}

function renderTable() {
  renderWithPerfIntl(<AgentPerfTable rows={ROWS} choice={CHOICE} range={RANGE} rangeShort="(30D)" />);
}

describe("AgentPerfTable", () => {
  it("renders the columns and sorts by accept rate in tiers, both directions, without a request (R-52, R-59, R-60, R-62, R-63)", () => {
    renderTable();
    expect(header(/^Agent/)).toBeInTheDocument();
    expect(header(/^Runs \(30D\)/)).toBeInTheDocument();
    expect(header(/^Avg cost.*DevDigest estimate/)).toBeInTheDocument();
    expect(header(/^Avg duration/)).toBeInTheDocument();
    expect(header(/^Last run/)).toBeInTheDocument();
    expect(header(/^View$/)).toBeInTheDocument();

    const acceptTh = header(/^Accept rate/);
    expect(acceptTh).toHaveAttribute("aria-sort", "descending");
    expect(order()).toEqual(["Alpha", "Bravo", "Delta", "Charlie", "Deleted agents", "Zero"]);

    fireEvent.click(within(acceptTh).getByRole("button"));
    expect(acceptTh).toHaveAttribute("aria-sort", "ascending");
    expect(order()).toEqual(["Bravo", "Alpha", "Delta", "Charlie", "Deleted agents", "Zero"]);

    const runsTh = header(/^Runs/);
    fireEvent.click(within(runsTh).getByRole("button"));
    expect(runsTh).toHaveAttribute("aria-sort", "descending");
    expect(acceptTh).not.toHaveAttribute("aria-sort");
    expect(order().at(-1)).toBe("Zero");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bands, badges and trends each row's accept rate (R-61, R-96, R-97, R-100, R-101)", () => {
    renderTable();
    expect(within(rowOf("Alpha")).getByText("70%").style.color).toBe("var(--ok)");
    expect(within(rowOf("Alpha")).getByText("up from 60%")).toBeInTheDocument();
    expect(within(rowOf("Bravo")).getByText("69%").style.color).toBe("var(--warn)");
    expect(within(rowOf("Bravo")).getByText("down from 80%")).toBeInTheDocument();
    expect(within(rowOf("Bravo")).getByText("Disabled")).toBeInTheDocument();
    expect(within(rowOf("Charlie")).getByText("100%").style.color).toBe("var(--text-secondary)");
    expect(within(rowOf("Charlie")).getByText("Small sample")).toBeInTheDocument();
    expect(within(rowOf("Charlie")).queryByText(/from \d+%/)).not.toBeInTheDocument();
    expect(within(rowOf("Delta")).getByText("25%").style.color).toBe("var(--text-secondary)");
  });

  it("shows zero-run and deleted rows, View links and the expand panel (R-56, R-57, R-58, R-64, R-86)", () => {
    renderTable();
    const zero = rowOf("Zero");
    expect(within(zero).getByText("0")).toBeInTheDocument();
    expect(within(zero).getAllByText("—").length).toBeGreaterThanOrEqual(4);
    expect(within(zero).getByText("0 decisions")).toBeInTheDocument();

    expect(within(rowOf("Deleted agents")).queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^View stats for / })).toHaveLength(5);
    const alpha = within(rowOf("Alpha")).getByRole("link", { name: "View stats for Alpha" });
    const href = new URL(alpha.getAttribute("href")!, "http://x");
    expect(href.pathname).toBe("/agents/a");
    expect(href.searchParams.get("tab")).toBe("stats");
    expect(href.searchParams.get("range")).toBe("30d");
    expect(href.searchParams.get("at")).toBe(RANGE.to.toISOString());

    const details = screen.getByRole("button", { name: "Details for Alpha" });
    expect(details).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(details);
    expect(details).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(details.getAttribute("aria-controls")!)!;
    expect(within(panel).getByText("Accepted")).toBeInTheDocument();
    expect(within(panel).getByText("Dismissed")).toBeInTheDocument();
    expect(within(panel).getByText("Pending")).toBeInTheDocument();
    expect(within(panel).getByText("Runs without a price")).toBeInTheDocument();
    expect(within(panel).getByText("gpt-4.1")).toBeInTheDocument();
    expect(within(panel).getByText("$0.400")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives an agent the same colour in its row and its donut legend; deleted is neutral (R-102, R-103)", () => {
    const r = report({
      agents: [agentRow("a1", "Security Reviewer"), deletedRow()],
      cost_by_agent: [
        { kind: "agent", agent_id: "a1", agent_name: "Security Reviewer", runs: 10, cost_usd: 0.4 },
        { kind: "deleted", agent_id: null, agent_name: null, runs: 2, cost_usd: 0.1 },
      ],
    });
    renderWithPerfIntl(
      <>
        <AgentPerfTable rows={r.agents} choice={CHOICE} range={RANGE} rangeShort="(30D)" />
        <CostBreakdown report={r} />
      </>,
    );
    const swatch = (row: HTMLElement) =>
      (row.querySelector("span[aria-hidden='true']") as HTMLElement).style.background;
    const legend = within(screen.getAllByRole("list")[0]!).getAllByRole("listitem");
    const legendSwatch = (i: number) => (legend[i]!.firstElementChild as HTMLElement).style.background;

    expect(swatch(rowOf("Security Reviewer"))).toBe(legendSwatch(0));
    expect(swatch(rowOf("Security Reviewer"))).not.toBe("");
    expect(agentColor("a1")).not.toBe(DELETED_AGENT_COLOR);
    expect(swatch(rowOf("Deleted agents"))).toBe(DELETED_AGENT_COLOR);
    expect(legendSwatch(1)).toBe(DELETED_AGENT_COLOR);
  });
});
