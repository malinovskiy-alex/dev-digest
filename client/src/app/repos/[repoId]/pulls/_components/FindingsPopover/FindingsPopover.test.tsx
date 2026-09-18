/**
 * FindingsPopover — the PR list's preview of what the latest run found.
 * It reads the same reviews query the PR detail page uses, so opening it is
 * both the fetch and a cache warm-up for the click that usually follows.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, ReviewRecord } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/prReview.json";

const usePrReviews = vi.fn();
vi.mock("@/lib/hooks/reviews", () => ({ usePrReviews: (id: string) => usePrReviews(id) }));

import { FindingsPopover } from "./FindingsPopover";

afterEach(() => {
  cleanup();
  usePrReviews.mockReset();
});

function finding(o: Partial<FindingRecord> & { id: string }): FindingRecord {
  return {
    severity: "WARNING",
    category: "bug",
    title: "Retry-After header omitted on 429",
    file: "src/middleware/ratelimit.ts",
    start_line: 52,
    end_line: 52,
    rationale: "The response omits Retry-After.",
    suggestion: null,
    confidence: 0.81,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...o,
  };
}

function review(findings: FindingRecord[]): ReviewRecord {
  return {
    id: "r1",
    pr_id: "pr-1",
    agent_id: "a1",
    run_id: "run-1",
    agent_name: "Security Reviewer",
    kind: "review",
    verdict: "request_changes",
    summary: "Block before merge.",
    score: 38,
    model: "deepseek-v4-flash",
    grounding: null,
    created_at: "2026-06-13T20:52:51.000Z",
    findings,
  };
}

function renderPopover() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <FindingsPopover
        id="pop-1"
        prId="pr-1"
        anchor={new DOMRect(10, 20, 80, 20)}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
      />
    </NextIntlClientProvider>,
  );
}

describe("FindingsPopover", () => {
  it("titles itself with how many findings the run produced", () => {
    usePrReviews.mockReturnValue({
      data: [review([finding({ id: "f1" }), finding({ id: "f2", severity: "CRITICAL" })])],
      isLoading: false,
      isError: false,
    });
    renderPopover();
    expect(screen.getByRole("dialog", { name: "2 findings in this run" })).toBeInTheDocument();
  });

  it("lists the worst findings first", () => {
    usePrReviews.mockReturnValue({
      data: [
        review([
          finding({ id: "f1", severity: "SUGGESTION", title: "Nit" }),
          finding({ id: "f2", severity: "CRITICAL", title: "Blocker" }),
        ]),
      ],
      isLoading: false,
      isError: false,
    });
    renderPopover();
    const titles = screen.getAllByText(/Blocker|Nit/).map((n) => n.textContent);
    expect(titles).toEqual(["Blocker", "Nit"]);
  });

  it("offers no controls — the preview is read-only", () => {
    usePrReviews.mockReturnValue({
      data: [review([finding({ id: "f1" })])],
      isLoading: false,
      isError: false,
    });
    renderPopover();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("says so when the latest run found nothing", () => {
    usePrReviews.mockReturnValue({ data: [review([])], isLoading: false, isError: false });
    renderPopover();
    expect(screen.getByText("No findings in the latest run.")).toBeInTheDocument();
  });

  it("surfaces a failed load instead of an empty panel", () => {
    usePrReviews.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderPopover();
    expect(screen.getByText("Couldn’t load findings.")).toBeInTheDocument();
  });
});
