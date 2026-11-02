import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../../messages/en/prReview.json";
import { VerdictBanner } from "./VerdictBanner";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("VerdictBanner (smoke)", () => {
  it("shows verdict label + score + finding/blocker counts", () => {
    renderWithIntl(
      <VerdictBanner
        verdict="request_changes"
        summary="Hardcoded secret introduced."
        score={42}
        findingsCount={1}
        blockers={1}
        agentName="Security Reviewer"
      />,
    );
    expect(screen.getByText("Request changes")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/1 findings · 1 blockers/)).toBeInTheDocument();
  });
});

describe("VerdictBanner — notes and summarySlot (BD-3)", () => {
  const props = {
    verdict: "request_changes" as const,
    summary: "Review text.",
    score: 61,
    findingsCount: 3,
    blockers: 1,
  };

  it("without them, the summary paragraph renders as before (Agent runs unchanged, R-83)", () => {
    renderWithIntl(<VerdictBanner {...props} />);
    expect(screen.getByText("Review text.")).toBeInTheDocument();
  });

  it("notes render after the title row and before the summary", () => {
    renderWithIntl(<VerdictBanner {...props} notes={<span>Review in progress</span>} />);
    const note = screen.getByText("Review in progress");
    const title = screen.getByText("Request changes");
    expect(title.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(note.compareDocumentPosition(screen.getByText("Review text.")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("summarySlot replaces the summary; verdict, counts and score stay", () => {
    renderWithIntl(<VerdictBanner {...props} summarySlot={<div role="status" aria-label="Generating…" />} />);
    expect(screen.getByRole("status", { name: "Generating…" })).toBeInTheDocument();
    expect(screen.queryByText("Review text.")).not.toBeInTheDocument();
    expect(screen.getByText("Request changes")).toBeInTheDocument();
    expect(screen.getByText("3 findings · 1 blockers")).toBeInTheDocument();
    expect(screen.getByText("61")).toBeInTheDocument();
  });

  it("summarySlot={null} still replaces the summary (only undefined falls back)", () => {
    renderWithIntl(<VerdictBanner {...props} summarySlot={null} />);
    expect(screen.queryByText("Review text.")).not.toBeInTheDocument();
    expect(screen.getByText("Request changes")).toBeInTheDocument();
  });
});
