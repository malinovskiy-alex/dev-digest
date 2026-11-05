import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Skill } from "@devdigest/shared";
import { EMPTY_FINDINGS, renderWithSkillsIntl, skillStatsReport } from "@/test/agent-performance-fixtures";

const replace = vi.fn();
let search = new URLSearchParams("tab=stats");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/skills/s1",
  useSearchParams: () => search,
}));

import { StatsTab } from "./StatsTab";

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

// The network boundary: the real hook runs over a stubbed fetch.
const fetchMock = vi.fn();
function json(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve({
    ok: status < 400,
    status,
    statusText: status < 400 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  } as Response);
}

let qc: QueryClient;
beforeEach(() => {
  replace.mockReset();
  fetchMock.mockReset();
  search = new URLSearchParams("tab=stats");
  vi.stubGlobal("fetch", fetchMock);
  qc = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderTab() {
  return renderWithSkillsIntl(
    <QueryClientProvider client={qc}>
      <StatsTab skill={SKILL} />
    </QueryClientProvider>,
  );
}

describe("skill StatsTab (L08 skill-stats C4)", () => {
  it("shows skeletons with no figure while loading (R-50)", () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    renderTab();
    expect(screen.getByRole("heading", { name: "Stats" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Range" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Used by" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+%?$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/30 days ·/)).not.toBeInTheDocument();
  });

  it("shows the figures, the notes, the list and the widget from one GET; applying '1 day' keeps the tab (R-29, R-31, R-47, R-48, R-52, R-81)", async () => {
    fetchMock.mockImplementation(() => json(skillStatsReport({ skill: { id: "s1", name: "OWASP Top 10", enabled: false } })));
    renderTab();

    expect(await screen.findByRole("heading", { name: "Used by" })).toBeInTheDocument();
    expect(screen.getByText("This skill is off — no agent sends it, so no run is attributed to it")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Figures cover the agents that use this skill now. Findings come from their runs and are not traced to the skill itself.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agents using this skill" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Findings by category" })).toBeInTheDocument();
    expect(screen.getByText("30 days · Oct 6, 12:00 – Nov 5, 12:00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "1 day" }));
    expect(replace).toHaveBeenCalledWith("/skills/s1?tab=stats&range=1d", { scroll: false });

    const calls = fetchMock.mock.calls as [string, RequestInit | undefined][];
    expect(calls.every(([, init]) => (init?.method ?? "GET") === "GET")).toBe(true);
    expect(new URL(calls[0]![0]).pathname).toBe("/skills/s1/stats");
  });

  it("keeps the four cards and the list on a range with no run; the widget says 'No findings in …' (R-49, R-65)", async () => {
    fetchMock.mockImplementation(() =>
      json(
        skillStatsReport({
          ran_in_period: 0,
          pull_frequency: { prs_with_skill: 0, prs_reviewed: 0, rate: null },
          figures: { accepted: 0, dismissed: 0, pending: 0, decided: 0, accept_rate: null },
          findings: EMPTY_FINDINGS,
          agents: [{ id: "a1", name: "Security Reviewer", enabled: true, runs: 0 }],
        }),
      ),
    );
    renderTab();
    expect(await screen.findByText("No findings in the last 30 days")).toBeInTheDocument();
    for (const title of ["Used by", "Pull frequency", "Accept rate", "Findings"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(screen.getByText("0 ran in period")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Security Reviewer" })).toBeInTheDocument();
    expect(screen.queryByText("This skill is off — no agent sends it, so no run is attributed to it")).not.toBeInTheDocument();
  });

  it("shows the reason and Retry on a failed read, and no figure (R-51)", async () => {
    fetchMock.mockImplementation(() => json({ error: { code: "boom", message: "Engine unreachable" } }, 500));
    renderTab();
    expect(await screen.findByRole("alert", undefined, { timeout: 3000 })).toHaveTextContent("Could not load skill stats");
    expect(screen.getByText("Engine unreachable")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Used by" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();

    fetchMock.mockImplementation(() => json(skillStatsReport()));
    fireEvent.click(screen.getByRole("button", { name: /Retry/ }));
    expect(await screen.findByRole("heading", { name: "Used by" })).toBeInTheDocument();
  });

  it("makes the page re-read the skill on a 404, without retrying (R-58, D-15)", async () => {
    fetchMock.mockImplementation(() => json({ error: { code: "not_found", message: "Skill not found" } }, 404));
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    renderTab();
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["skill", "s1"] }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
