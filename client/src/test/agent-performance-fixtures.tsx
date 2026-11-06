/* Test-only fixtures for the Agent Performance dashboard, the agent Stats tab
   (L08) and the skill Stats tab (L08 skill-stats): contract-shaped builders plus
   intl wrappers — `agentPerformance`, or `skills` + `agentPerformance` — with a
   fixed `now` and UTC. */
import React from "react";
import { render, type RenderResult } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type {
  AgentPerfFigures,
  AgentPerfTableRow,
  AgentPerformanceReport,
  AgentStatsReport,
  FindingsBreakdown,
  PerfComparison,
  SkillStatsReport,
} from "@devdigest/shared";
import agentPerformance from "../../messages/en/agentPerformance.json";
import skills from "../../messages/en/skills.json";

export const NOW = new Date("2026-11-05T12:00:00.000Z");

export const RANGE = {
  from: "2026-10-06T12:00:00.000Z",
  to: "2026-11-05T12:00:00.000Z",
  tz: "UTC",
  previous: { from: "2026-09-06T12:00:00.000Z", to: "2026-10-06T12:00:00.000Z" },
};

export function figures(over: Partial<AgentPerfFigures> = {}): AgentPerfFigures {
  return {
    runs: 10,
    priced_runs: 10,
    unpriced_runs: 0,
    total_cost_usd: 0.4,
    avg_cost_usd: 0.04,
    avg_duration_ms: 6234,
    accepted: 8,
    dismissed: 2,
    pending: 3,
    decided: 10,
    accept_rate: 0.8,
    last_run_at: "2026-11-05T11:56:00.000Z",
    ...over,
  };
}

export function comparison(over: Partial<PerfComparison> = {}): PerfComparison {
  return {
    previous_runs: 5,
    previous_total_cost_usd: 0.28,
    previous_decided: 10,
    previous_accept_rate: 0.6,
    cost_delta_usd: 0.12,
    accept_trend: "up",
    ...over,
  };
}

/** A zero-run row: every figure unknown or 0 (R-57). */
export const ZERO_FIGURES = figures({
  runs: 0,
  priced_runs: 0,
  total_cost_usd: null,
  avg_cost_usd: null,
  avg_duration_ms: null,
  accepted: 0,
  dismissed: 0,
  pending: 0,
  decided: 0,
  accept_rate: null,
  last_run_at: null,
});

export function agentRow(
  id: string,
  name: string,
  over: Partial<Omit<AgentPerfTableRow, "kind" | "agent_id" | "agent_name">> = {},
): AgentPerfTableRow {
  return {
    kind: "agent",
    agent_id: id,
    agent_name: name,
    enabled: true,
    figures: figures(),
    comparison: comparison(),
    cost_by_model: [{ provider: "openai", model: "gpt-4.1", runs: 10, cost_usd: 0.4 }],
    ...over,
  };
}

export function deletedRow(over: Partial<AgentPerfTableRow> = {}): AgentPerfTableRow {
  return {
    kind: "deleted",
    agent_id: null,
    agent_name: null,
    enabled: null,
    figures: figures({ runs: 2, priced_runs: 2, total_cost_usd: 0.1, avg_cost_usd: 0.05, accepted: 1, dismissed: 0, decided: 1, accept_rate: 1, pending: 0 }),
    comparison: comparison({ accept_trend: null, previous_accept_rate: null, cost_delta_usd: null, previous_total_cost_usd: null }),
    cost_by_model: [{ provider: "openai", model: "gpt-4.1", runs: 2, cost_usd: 0.1 }],
    ...over,
  };
}

export function report(over: Partial<AgentPerformanceReport> = {}): AgentPerformanceReport {
  const agents = over.agents ?? [agentRow("a1", "Security Reviewer"), agentRow("a2", "Style Checker", { figures: figures({ runs: 4, total_cost_usd: 0.2, accept_rate: 0.5, accepted: 5, decided: 10, dismissed: 5 }) })];
  return {
    range: RANGE,
    totals: {
      runs: 14,
      unpriced_runs: 0,
      total_cost_usd: 0.6,
      accepted: 13,
      decided: 20,
      accept_rate: 0.65,
      comparison: comparison({ cost_delta_usd: -1.2, previous_total_cost_usd: 1.8 }),
      bucket_unit: "day",
      run_buckets: [
        { key: "2026-10-10", runs: 4 },
        { key: "2026-11-05", runs: 10 },
      ],
    },
    most_active_agent_id: "a1",
    agents,
    cost_by_agent: [
      { kind: "agent", agent_id: "a1", agent_name: "Security Reviewer", runs: 10, cost_usd: 0.4 },
      { kind: "agent", agent_id: "a2", agent_name: "Style Checker", runs: 4, cost_usd: 0.2 },
    ],
    cost_by_model: [{ provider: "openai", model: "gpt-4.1", runs: 14, cost_usd: 0.6 }],
    ...over,
  };
}

/**
 * A findings breakdown (L08 skill-stats). The default adds up to 13 — the
 * accepted + dismissed + pending of `figures()` — on both axes.
 */
export function findingsBreakdown(over: Partial<FindingsBreakdown> = {}): FindingsBreakdown {
  return {
    total: 13,
    by_category: { security: 5, bug: 4, perf: 2, style: 1, test: 1, other: 0 },
    by_severity: { CRITICAL: 3, WARNING: 6, SUGGESTION: 4, other: 0 },
    ...over,
  };
}

/** A breakdown with no finding at all. */
export const EMPTY_FINDINGS: FindingsBreakdown = {
  total: 0,
  by_category: { security: 0, bug: 0, perf: 0, style: 0, test: 0, other: 0 },
  by_severity: { CRITICAL: 0, WARNING: 0, SUGGESTION: 0, other: 0 },
};

export function statsReport(over: Partial<AgentStatsReport> = {}): AgentStatsReport {
  return {
    range: RANGE,
    agent: { id: "a1", name: "Security Reviewer" },
    figures: figures(),
    comparison: comparison(),
    cost_by_model: [{ provider: "openai", model: "gpt-4.1", runs: 10, cost_usd: 0.4 }],
    findings: findingsBreakdown(),
    ...over,
  };
}

/** A skill Stats report (L08 skill-stats): two agents using the skill, one ran. */
export function skillStatsReport(over: Partial<SkillStatsReport> = {}): SkillStatsReport {
  return {
    range: RANGE,
    skill: { id: "s1", name: "OWASP Top 10", enabled: true },
    used_by: 2,
    ran_in_period: 1,
    pull_frequency: { prs_with_skill: 2, prs_reviewed: 2, rate: 1 },
    figures: { accepted: 8, dismissed: 2, pending: 3, decided: 10, accept_rate: 0.8 },
    findings: findingsBreakdown(),
    agents: [
      { id: "a1", name: "Security Reviewer", enabled: true, runs: 1 },
      { id: "a3", name: "Test Quality Reviewer", enabled: false, runs: 0 },
    ],
    ...over,
  };
}

/** Render under the `skills` and `agentPerformance` namespaces with a fixed clock and zone. */
export function renderWithSkillsIntl(ui: React.ReactElement): RenderResult {
  return render(
    <NextIntlClientProvider locale="en" timeZone="UTC" now={NOW} messages={{ skills, agentPerformance }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

/** Render under the `agentPerformance` namespace with a fixed clock and zone. */
export function renderWithPerfIntl(ui: React.ReactElement): RenderResult {
  return render(
    <NextIntlClientProvider locale="en" timeZone="UTC" now={NOW} messages={{ agentPerformance }}>
      {ui}
    </NextIntlClientProvider>,
  );
}
