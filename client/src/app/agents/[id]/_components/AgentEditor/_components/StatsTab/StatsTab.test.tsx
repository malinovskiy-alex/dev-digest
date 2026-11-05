import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import type { Agent } from "@devdigest/shared";
import { comparison, figures, renderWithPerfIntl, statsReport } from "@/test/agent-performance-fixtures";
import { ApiError } from "@/lib/api";

const replace = vi.fn();
let search = new URLSearchParams("tab=stats");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/agents/a1",
  useSearchParams: () => search,
}));

// The data boundary: the hook stands in for the GET (R-83).
const refetch = vi.fn();
const useAgentStats = vi.fn();
vi.mock("@/lib/hooks/agent-performance", () => ({
  useAgentStats: (...args: unknown[]) => useAgentStats(...args),
}));

import { StatsTab } from "./StatsTab";

const AGENT: Agent = {
  id: "a1",
  name: "Security Reviewer",
  description: "",
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 1,
  skill_count: 0,
};

function state(over: Record<string, unknown>) {
  useAgentStats.mockReturnValue({ data: undefined, isError: false, error: null, refetch, ...over });
}

function tile(title: string): HTMLElement {
  return screen.getByRole("heading", { name: title }).parentElement!;
}

beforeEach(() => {
  replace.mockReset();
  refetch.mockReset();
  useAgentStats.mockReset();
  search = new URLSearchParams("tab=stats");
});
afterEach(cleanup);

describe("StatsTab", () => {
  it("shows every figure with the dashboard's formats, delta, trend and band — no sparkline (R-76, R-77, R-107, R-109, R-111, R-112)", () => {
    state({ data: statsReport() });
    renderWithPerfIntl(<StatsTab agent={AGENT} />);
    expect(screen.getByRole("group", { name: "Range" })).toBeInTheDocument();
    expect(within(tile("Runs (30D)")).getByText("10")).toBeInTheDocument();
    const cost = tile("Total cost (30D)");
    expect(within(cost).getByText("$0.400")).toBeInTheDocument();
    expect(within(cost).getByText("DevDigest estimate")).toBeInTheDocument();
    expect(within(cost).getByText("+$0.120")).toBeInTheDocument();
    expect(within(cost).getByText("estimate difference vs previous period")).toBeInTheDocument();
    expect(within(tile("Avg cost (30D)")).getByText("$0.040")).toBeInTheDocument();
    expect(within(tile("Runs without a price (30D)")).getByText("0")).toBeInTheDocument();
    expect(within(tile("Avg duration (30D)")).getByText("6.2s")).toBeInTheDocument();
    const accept = tile("Accept rate (30D)");
    expect(within(accept).getByText("80%").style.color).toBe("var(--ok)");
    expect(within(accept).getByText("8/10")).toBeInTheDocument();
    expect(within(accept).getByText("up from 60%")).toBeInTheDocument();
    expect(within(tile("Accepted")).getByText("8")).toBeInTheDocument();
    expect(within(tile("Dismissed")).getByText("2")).toBeInTheDocument();
    expect(within(tile("Pending")).getByText("3")).toBeInTheDocument();
    expect(within(tile("Last run")).getByText("4 minutes ago")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Reconciled billing is not connected — costs are DevDigest estimates from token counts and model prices.",
      ),
    ).toBeInTheDocument();
    // No sparkline, no ring (R-112): the only chart is the Findings widget's ring (L08 skill-stats R-69).
    const chart = screen.getByRole("img", { name: "Findings by category" });
    expect(screen.getAllByRole("img").every((el) => chart.contains(el))).toBe(true);
  });

  it("hides delta and trend when unknown, stays neutral on a small sample, dashes an unknown cost (R-81, R-82, R-108, R-110, R-111)", () => {
    state({
      data: statsReport({
        figures: figures({
          priced_runs: 0,
          unpriced_runs: 10,
          total_cost_usd: null,
          avg_cost_usd: null,
          accepted: 3,
          dismissed: 1,
          decided: 4,
          accept_rate: 0.75,
        }),
        comparison: comparison({
          cost_delta_usd: null,
          previous_total_cost_usd: null,
          accept_trend: null,
          previous_accept_rate: null,
        }),
      }),
    });
    renderWithPerfIntl(<StatsTab agent={AGENT} />);
    const cost = tile("Total cost (30D)");
    expect(within(cost).getByText("—")).toBeInTheDocument();
    expect(within(cost).getByText("10 runs without a price — not included")).toBeInTheDocument();
    expect(within(cost).queryByText(/estimate difference/)).not.toBeInTheDocument();
    expect(within(tile("Avg cost (30D)")).getByText("—")).toBeInTheDocument();
    const accept = tile("Accept rate (30D)");
    expect(within(accept).getByText("75%").style.color).toBe("var(--text-secondary)");
    expect(within(accept).getByText("Small sample")).toBeInTheDocument();
    expect(within(accept).queryByText(/from \d+%/)).not.toBeInTheDocument();
  });

  it("shows skeletons, then an error with Retry, then the empty range (R-78, R-79, R-80)", () => {
    state({});
    renderWithPerfIntl(<StatsTab agent={AGENT} />);
    expect(screen.queryByRole("heading", { name: /Runs/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    cleanup();

    state({ isError: true, error: new ApiError("Agent not found", 404) });
    renderWithPerfIntl(<StatsTab agent={AGENT} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load agent stats");
    expect(screen.getByText("Agent not found")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
    cleanup();

    state({ data: statsReport({ figures: figures({ runs: 0 }) }) });
    renderWithPerfIntl(<StatsTab agent={AGENT} />);
    expect(screen.getByText("No runs of Security Reviewer in the last 30 days")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Range" })).toBeInTheDocument();
  });

  it("keeps the tab and the agent when the range changes, and reads a pinned View link (R-56, R-84)", () => {
    search = new URLSearchParams("tab=stats&range=30d&at=2026-10-01T12:00:00.000Z");
    state({ data: statsReport() });
    renderWithPerfIntl(<StatsTab agent={AGENT} />);
    const [id, range] = useAgentStats.mock.calls[0]! as [string, { from: Date; to: Date }];
    expect(id).toBe("a1");
    expect(range.to.toISOString()).toBe("2026-10-01T12:00:00.000Z");

    fireEvent.click(screen.getByRole("button", { name: "1 day" }));
    expect(replace).toHaveBeenCalledWith("/agents/a1?tab=stats&range=1d", { scroll: false });
  });

  it("shows the Findings widget after the last tile and before the estimate note, and the applied-window caption (L08 skill-stats C7, R-32, R-68, R-69)", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    state({ data: statsReport() });
    renderWithPerfIntl(<StatsTab agent={AGENT} />);

    const widget = screen.getByRole("region", { name: "Findings by category" });
    const lastTile = tile("Last run");
    const note = screen.getByText(/Reconciled billing is not connected/);
    // DOM order: last tile → widget → estimate note.
    expect(lastTile.compareDocumentPosition(widget) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(widget.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The total is accepted + dismissed + pending of the same report: 8 + 2 + 3.
    expect(within(screen.getByRole("img", { name: "Findings by category" })).getByText("13")).toBeInTheDocument();
    // The caption names the response's window, in its zone.
    expect(screen.getByText("30 days · Oct 6, 12:00 – Nov 5, 12:00")).toBeInTheDocument();
    // The widget reads the tab's own report: one hook, no request of its own (R-70).
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("shows no caption while loading or on error (R-33)", () => {
    state({});
    renderWithPerfIntl(<StatsTab agent={AGENT} />);
    expect(screen.queryByText(/30 days ·/)).not.toBeInTheDocument();
    cleanup();
    state({ isError: true, error: new ApiError("boom", 500), data: statsReport() });
    renderWithPerfIntl(<StatsTab agent={AGENT} />);
    expect(screen.queryByText(/30 days ·/)).not.toBeInTheDocument();
  });
});
