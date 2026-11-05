import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { agentRow, renderWithPerfIntl, report } from "@/test/agent-performance-fixtures";
import { ApiError } from "@/lib/api";

// Cross-cutting chrome with its own providers; this suite is about the screen.
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/agent-performance",
  useSearchParams: () => search,
}));

let activeRepo: { id: string; full_name: string } | null = null;
vi.mock("@/lib/repo-context", () => ({
  useActiveRepo: () => ({ repoId: activeRepo?.id ?? null, repos: [], activeRepo, setRepoId: vi.fn(), reposLoaded: true }),
}));

// The data boundary: the hook stands in for the GET (R-74 — the screen has no other request path).
const refetch = vi.fn();
const useAgentPerformance = vi.fn();
vi.mock("@/lib/hooks/agent-performance", () => ({
  useAgentPerformance: (...args: unknown[]) => useAgentPerformance(...args),
}));

import { AgentPerformanceView } from "./AgentPerformanceView";

function state(over: Record<string, unknown>) {
  useAgentPerformance.mockReturnValue({ data: undefined, isError: false, error: null, refetch, ...over });
}

beforeEach(() => {
  replace.mockReset();
  refetch.mockReset();
  useAgentPerformance.mockReset();
  search = new URLSearchParams();
  activeRepo = null;
});
afterEach(cleanup);

describe("AgentPerformanceView", () => {
  it("shows the header and skeletons while loading — no figure (R-43, R-70)", () => {
    state({});
    renderWithPerfIntl(<AgentPerformanceView />);
    expect(screen.getByRole("heading", { name: "Agent Performance" })).toBeInTheDocument();
    expect(screen.getByText("Which agents earn their keep — accept rate is the quality signal")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Range" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Total runs/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
    // Default range: 30 days, per-day buckets (R-33, R-90).
    expect(useAgentPerformance.mock.calls[0]![1]).toBe("day");
  });

  it("shows the reason and Retry on a failed read, and no figure (R-71)", () => {
    state({ isError: true, error: new ApiError("Engine unreachable", 0) });
    renderWithPerfIntl(<AgentPerformanceView />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load agent performance");
    expect(screen.getByText("Engine unreachable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows 'No agents yet' with a link to Agents (R-72)", () => {
    state({ data: report({ agents: [] }) });
    renderWithPerfIntl(<AgentPerformanceView />);
    expect(screen.getByText("No agents yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Agents" })).toHaveAttribute("href", "/agents");
  });

  it("shows the empty range with the control, and the PR link only with an active repo (R-73, R-104, R-105)", () => {
    const empty = report({ agents: [agentRow("a1", "Security Reviewer")] });
    empty.totals = { ...empty.totals, runs: 0 };
    state({ data: empty });
    renderWithPerfIntl(<AgentPerformanceView />);
    expect(screen.getByText("No agent runs in the last 30 days")).toBeInTheDocument();
    expect(screen.getByText("Pick a longer range or run a review")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Range" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Go to Pull Requests" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    cleanup();

    activeRepo = { id: "r1", full_name: "acme/api" };
    renderWithPerfIntl(<AgentPerformanceView />);
    expect(screen.getByRole("link", { name: "Go to Pull Requests" })).toHaveAttribute("href", "/repos/r1/pulls");
  });

  it("shows KPIs, the billing note, the table and the breakdown; a range change rewrites the address (R-38, R-44, R-46)", () => {
    state({ data: report() });
    renderWithPerfIntl(<AgentPerformanceView />);
    expect(screen.getByRole("heading", { name: "Total runs (30D)" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Reconciled billing is not connected — costs are DevDigest estimates from token counts and model prices.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Cost by agent" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "1 day" }));
    expect(replace).toHaveBeenCalledWith("/agent-performance?range=1d", { scroll: false });
  });

  it("reads the 1-day preset from the address and asks for hourly buckets (R-90)", () => {
    search = new URLSearchParams("range=1d");
    state({});
    renderWithPerfIntl(<AgentPerformanceView />);
    const [range, bucket] = useAgentPerformance.mock.calls[0]! as [{ from: Date; to: Date }, string];
    expect(bucket).toBe("hour");
    expect(range.to.getTime() - range.from.getTime()).toBe(24 * 3_600_000);
  });

  it("shows the applied-window caption beside the range control with data, not while loading (L08 skill-stats C3, R-32)", () => {
    state({});
    renderWithPerfIntl(<AgentPerformanceView />);
    expect(screen.queryByText(/30 days ·/)).not.toBeInTheDocument();
    cleanup();

    state({ data: report() });
    renderWithPerfIntl(<AgentPerformanceView />);
    const caption = screen.getByText("30 days · Oct 6, 12:00 – Nov 5, 12:00");
    // Beside the control: both in the header.
    expect(caption.closest("header")).toBe(screen.getByRole("group", { name: "Range" }).closest("header"));
  });
});
