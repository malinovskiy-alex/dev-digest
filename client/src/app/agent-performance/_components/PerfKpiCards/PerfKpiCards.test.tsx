import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import agentPerformance from "../../../../../messages/en/agentPerformance.json";
import { agentRow, comparison, figures, renderWithPerfIntl, report } from "@/test/agent-performance-fixtures";
import { PerfKpiCards } from "./PerfKpiCards";

afterEach(cleanup);

function card(title: string): HTMLElement {
  return screen.getByRole("heading", { name: title }).parentElement!;
}

describe("PerfKpiCards", () => {
  it("shows the four cards with range-labelled titles, sparkline, delta, ring and bands (R-40, R-44, R-90, R-94, R-98, R-100)", () => {
    renderWithPerfIntl(<PerfKpiCards report={report()} rangeShort="(30D)" />);

    const runs = card("Total runs (30D)");
    expect(within(runs).getByText("14")).toBeInTheDocument();
    expect(within(runs).getByRole("img", { name: "Runs per day" })).toBeInTheDocument();

    const cost = card("Total cost (30D)");
    expect(within(cost).getByText("$0.600")).toBeInTheDocument();
    expect(within(cost).getByText("DevDigest estimate")).toBeInTheDocument();
    expect(within(cost).getByText("−$1.200")).toBeInTheDocument();
    expect(within(cost).getByText("estimate difference vs previous period")).toBeInTheDocument();

    const accept = card("Avg accept rate (30D)");
    expect(within(accept).getByText("65%").style.color).toBe("var(--warn)");
    expect(within(accept).getByText("13/20 decisions")).toBeInTheDocument();
    const ring = accept.querySelector("svg");
    expect(ring).not.toBeNull();
    expect(ring).toHaveAttribute("aria-hidden", "true");

    const most = card("Most-active agent (30D)");
    expect(within(most).getByText("Security Reviewer")).toBeInTheDocument();
    expect(most).toHaveTextContent("10 runs · 80% accept");
    expect(within(most).getByText("80% accept").style.color).toBe("var(--ok)");
  });

  it("handles unknown cost and rate: dash, unpriced line, no delta, no ring (R-47, R-48, R-49, R-95, R-99)", () => {
    const r = report({
      agents: [agentRow("a1", "Security Reviewer", { figures: figures({ accept_rate: null, decided: 0, accepted: 0, dismissed: 0 }) })],
    });
    r.totals = {
      ...r.totals,
      total_cost_usd: null,
      unpriced_runs: 1,
      accept_rate: null,
      accepted: 0,
      decided: 0,
      comparison: comparison({ cost_delta_usd: null, previous_total_cost_usd: null }),
    };
    renderWithPerfIntl(<PerfKpiCards report={r} rangeShort="(30D)" />);

    const cost = card("Total cost (30D)");
    expect(within(cost).getByText("—")).toBeInTheDocument();
    expect(within(cost).getByText("1 run without a price — not included")).toBeInTheDocument();
    expect(within(cost).queryByText(/estimate difference/)).not.toBeInTheDocument();
    expect(cost).not.toHaveTextContent("$0");

    const accept = card("Avg accept rate (30D)");
    expect(within(accept).getByText("No decided findings")).toBeInTheDocument();
    expect(accept.querySelector("svg")).toBeNull();

    expect(card("Most-active agent (30D)")).toHaveTextContent("10 runs · no decisions");
  });

  it("names the hourly sparkline and draws a single bucket without NaN (R-92, D-18)", () => {
    const hourly = report();
    hourly.range = { ...hourly.range, from: "2026-11-04T12:00:00.000Z" };
    hourly.totals = { ...hourly.totals, bucket_unit: "hour", run_buckets: [{ key: "2026-11-05T11", runs: 14 }] };
    renderWithPerfIntl(<PerfKpiCards report={hourly} rangeShort="(1D)" />);
    expect(screen.getByRole("img", { name: "Runs per hour" })).toBeInTheDocument();
    cleanup();

    const single = report({ most_active_agent_id: null });
    single.range = { ...single.range, from: "2026-11-05T00:00:00.000Z", to: "2026-11-06T00:00:00.000Z" };
    single.totals = { ...single.totals, run_buckets: [{ key: "2026-11-05", runs: 14 }] };
    renderWithPerfIntl(<PerfKpiCards report={single} rangeShort="(5 Nov 2026 – 5 Nov 2026)" />);
    const spark = screen.getByRole("img", { name: "Runs per day" });
    expect(spark.innerHTML).not.toContain("NaN");
    expect(card("Most-active agent (5 Nov 2026 – 5 Nov 2026)")).toHaveTextContent("—");
  });

  it("walks the range once per report, not on every render (F-03)", () => {
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts");
    const r = report();
    const ui = (n: number) => (
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ agentPerformance }}>
        <PerfKpiCards report={r} rangeShort={n % 2 ? "(30D)" : "(30D) "} />
      </NextIntlClientProvider>
    );
    const view = render(ui(1));
    const afterFirst = spy.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);
    view.rerender(ui(2));
    view.rerender(ui(3));
    expect(spy.mock.calls.length).toBe(afterFirst);
    spy.mockRestore();
  });
});
