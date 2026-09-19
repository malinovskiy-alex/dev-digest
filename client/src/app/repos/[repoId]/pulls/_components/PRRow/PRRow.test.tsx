/**
 * PRRow — the two review-derived cells. Cost: a reviewed PR shows what the
 * latest run cost, an unreviewed one "—", because the column must not imply
 * that an unreviewed PR was free. Findings: the latest review's severity
 * split, and "—" when there is nothing to split.
 *
 * Both cells render "—" in the empty case, so assertions here are scoped to a
 * cell rather than matching on the dash across the whole row.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrMeta } from "@/lib/types";
import prReview from "../../../../../../../messages/en/prReview.json";
import common from "../../../../../../../messages/en/common.json";
import { PRRow } from "./PRRow";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

afterEach(cleanup);

function pr(o: Partial<PrMeta>): PrMeta {
  return {
    id: "pr-1",
    number: 482,
    title: "Add rate limiting to public API endpoints",
    author: "marisa.koch",
    branch: "feat/rate-limit-public",
    base: "main",
    head_sha: "abc1234",
    additions: 247,
    deletions: 38,
    files_count: 9,
    status: "needs_review",
    opened_at: "2026-06-13T18:00:00.000Z",
    updated_at: "2026-06-13T18:00:00.000Z",
    score: 61,
    cost_usd: null,
    findings: { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 },
    ...o,
  };
}

/** The row is a CSS grid of sibling cells; find one by what it contains. */
function cellContaining(text: string): HTMLElement {
  return screen.getByText(text).closest("div")!;
}

function renderRow(meta: PrMeta) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview, common }}>
      <PRRow pr={meta} repoId="repo-1" />
    </NextIntlClientProvider>,
  );
}

describe("PRRow — Cost cell", () => {
  it("shows the latest run's cost", () => {
    renderRow(pr({ cost_usd: 0.0141 }));
    expect(screen.getByText("$0.014")).toBeInTheDocument();
  });

  it("shows an em dash for a PR that has never been reviewed", () => {
    renderRow(pr({ cost_usd: null, score: 42 }));
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
});

describe("PRRow — Findings cell", () => {
  it("shows the latest review's findings split by severity", () => {
    renderRow(pr({ findings: { CRITICAL: 2, WARNING: 2, SUGGESTION: 2 } }));
    expect(screen.getByTitle("2 Critical")).toBeInTheDocument();
    expect(screen.getByTitle("2 Warning")).toBeInTheDocument();
    expect(screen.getByTitle("2 Suggestion")).toBeInTheDocument();
  });

  it("omits a severity the review did not produce", () => {
    renderRow(pr({ findings: { CRITICAL: 0, WARNING: 4, SUGGESTION: 3 } }));
    expect(screen.queryByTitle(/Critical/)).not.toBeInTheDocument();
    expect(screen.getByTitle("4 Warning")).toBeInTheDocument();
  });

  it("shows an em dash for a PR with no findings", () => {
    renderRow(pr({ findings: { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 }, cost_usd: 0.01 }));
    // Cost is set, so the only dash on the row is the findings cell's.
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(within(cellContaining("—")).queryByTitle(/Critical|Warning|Suggestion/)).toBeNull();
  });
});
