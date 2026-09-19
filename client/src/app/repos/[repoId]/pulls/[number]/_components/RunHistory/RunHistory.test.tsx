/**
 * RunHistory — the badge must reflect the review OUTCOME, not the run lifecycle.
 * Regression guard for the "green ✓ done on a run that found 5 blockers" bug:
 * a settled run is colored/labelled by its denormalized blocker/finding counts,
 * and shows the review score ring.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { RunSummary } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";
import common from "../../../../../../../../messages/en/common.json";
import { RunHistory } from "./RunHistory";

afterEach(cleanup);

function run(o: Partial<RunSummary>): RunSummary {
  return {
    run_id: "run-1",
    agent_id: "a1",
    agent_name: "Security Reviewer",
    provider: "openrouter",
    model: "deepseek/deepseek-v4-flash",
    status: "done",
    error: null,
    duration_ms: 1000,
    tokens_in: 100,
    tokens_out: 50,
    cost_usd: null,
    findings_count: 0,
    grounding: "0/0 passed",
    ran_at: "2026-06-11T18:44:34.000Z",
    score: null,
    blockers: null,
    ...o,
  };
}

function renderRuns(
  runs: RunSummary[],
  severityByRun?: Record<string, Partial<Record<"CRITICAL" | "WARNING" | "SUGGESTION", number>>>,
) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages, common }}>
      <RunHistory runs={runs} severityByRun={severityByRun} onOpenTrace={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe("RunHistory — outcome badge", () => {
  it("a done run WITH blockers reads 'rejected' (never green 'done') + shows the score ring", () => {
    renderRuns([run({ status: "done", findings_count: 5, blockers: 5, score: 0 })]);
    expect(screen.getByText("rejected")).toBeInTheDocument();
    expect(screen.queryByText("done")).not.toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument(); // CircularScore renders the number
    expect(screen.getByText(/5 blockers/)).toBeInTheDocument();
  });

  it("a clean done run reads 'approved'", () => {
    renderRuns([run({ status: "done", findings_count: 0, blockers: 0, score: 95 })]);
    expect(screen.getByText("approved")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
  });

  it("a done run with non-blocking findings reads 'reviewed'", () => {
    renderRuns([run({ status: "done", findings_count: 3, blockers: 0, score: 72 })]);
    expect(screen.getByText("reviewed")).toBeInTheDocument();
    expect(screen.queryByText(/blockers/)).not.toBeInTheDocument();
  });

  it("a failed run reads 'error'", () => {
    renderRuns([run({ status: "failed", error: "boom", score: null, blockers: null })]);
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("a running run reads 'running'", () => {
    renderRuns([run({ status: "running", score: null, blockers: null })]);
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});

describe("RunHistory — run cost", () => {
  it("a settled run shows tokens + cost beside its timestamp", () => {
    renderRuns([
      run({ status: "done", tokens_in: 8000, tokens_out: 1119, cost_usd: 0.0013, score: 72 }),
    ]);
    expect(screen.getByText("9,119 tok · $0.0013")).toBeInTheDocument();
  });

  it("an errored run shows no cost line at all", () => {
    renderRuns([run({ status: "failed", error: "429 quota", score: null, blockers: null })]);
    expect(screen.queryByText(/tok/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
});

describe("RunHistory — severity chips", () => {
  it("splits a settled run's findings by severity, keeping the blocker count", () => {
    renderRuns([run({ status: "done", findings_count: 3, blockers: 2, score: 38 })], {
      "run-1": { CRITICAL: 2, WARNING: 1 },
    });
    expect(screen.getByTitle("2 Critical")).toBeInTheDocument();
    expect(screen.getByTitle("1 Warning")).toBeInTheDocument();
    expect(screen.getByText(/2 blockers/)).toBeInTheDocument();
  });

  it("the chips are a read-out, not a control", () => {
    renderRuns([run({ status: "done", findings_count: 3, blockers: 0 })], {
      "run-1": { CRITICAL: 3 },
    });
    // The only buttons on a timeline row are the agent name and the icon
    // actions — never a severity chip.
    expect(
      screen.queryAllByRole("button").some((b) => b.getAttribute("aria-pressed") !== null),
    ).toBe(false);
  });

  it("falls back to the plain count for a run whose review was deleted", () => {
    renderRuns([run({ status: "done", findings_count: 3, blockers: 0 })]);
    expect(screen.getByText(/3 finding/)).toBeInTheDocument();
  });
});
