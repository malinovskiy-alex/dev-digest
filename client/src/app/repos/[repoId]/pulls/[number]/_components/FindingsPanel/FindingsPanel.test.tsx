import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(cleanup);

function finding(o: Partial<FindingRecord> & { id: string }): FindingRecord {
  return {
    severity: "CRITICAL",
    category: "security",
    title: "Hardcoded secret",
    file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    rationale: "A secret is committed.",
    suggestion: null,
    confidence: 0.95,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...o,
  };
}

const FINDINGS: FindingRecord[] = [finding({ id: "f1" })];

/** 2 CRITICAL + 3 WARNING, one of the warnings below the confidence cutoff. */
const MIXED: FindingRecord[] = [
  finding({ id: "c1", severity: "CRITICAL", title: "Critical one" }),
  finding({ id: "c2", severity: "CRITICAL", title: "Critical two" }),
  finding({ id: "w1", severity: "WARNING", title: "Warning one" }),
  finding({ id: "w2", severity: "WARNING", title: "Warning two" }),
  finding({ id: "w3", severity: "WARNING", title: "Warning three", confidence: 0.4 }),
];

const criticalPill = () => screen.getByRole("button", { name: /Critical/i });
const warningPill = () => screen.getByRole("button", { name: /Warning$/i });
const titles = () => MIXED.map((f) => f.title).filter((t) => screen.queryByText(t) !== null);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("FindingsPanel (smoke)", () => {
  it("renders the toolbar + a finding card", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(screen.getByText("Hide low confidence")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
  });
});

describe("FindingsPanel — severity tally", () => {
  it("counts exactly the cards it renders", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    expect(criticalPill()).toHaveTextContent("2");
    expect(warningPill()).toHaveTextContent("3");
    expect(titles()).toEqual([
      "Critical one",
      "Critical two",
      "Warning one",
      "Warning two",
      "Warning three",
    ]);
  });

  it("renders no chip for a severity with no findings", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    expect(screen.queryByRole("button", { name: /Suggestion/i })).not.toBeInTheDocument();
  });

  it("filters to one severity, and restores the full list on a second click", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.click(criticalPill());
    expect(criticalPill()).toHaveAttribute("aria-pressed", "true");
    expect(titles()).toEqual(["Critical one", "Critical two"]);

    fireEvent.click(criticalPill());
    expect(criticalPill()).toHaveAttribute("aria-pressed", "false");
    expect(titles()).toHaveLength(5);
  });

  it("drops the count and the card together when low confidence is hidden", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    expect(warningPill()).toHaveTextContent("3");

    fireEvent.click(screen.getByRole("switch"));

    expect(warningPill()).toHaveTextContent("2");
    expect(screen.queryByText("Warning three")).not.toBeInTheDocument();
  });

  it("clears a filter whose severity the confidence toggle just emptied", () => {
    const only = [finding({ id: "w3", severity: "WARNING", title: "Warning three", confidence: 0.4 })];
    renderWithIntl(<FindingsPanel findings={[...MIXED.slice(0, 2), ...only]} prId="pr1" />);
    fireEvent.click(warningPill());
    expect(screen.getByText("Warning three")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch"));

    // The warning bucket is empty now, so the filter releases rather than
    // leaving the panel showing nothing.
    expect(screen.queryByRole("button", { name: /Warning/i })).not.toBeInTheDocument();
    expect(screen.getByText("Critical one")).toBeInTheDocument();
  });

  it("keeps each run card's filter to itself", () => {
    const { container } = renderWithIntl(
      <>
        <div data-testid="run-a">
          <FindingsPanel findings={MIXED} prId="pr1" />
        </div>
        <div data-testid="run-b">
          <FindingsPanel findings={MIXED} prId="pr1" />
        </div>
      </>,
    );
    const [runA, runB] = Array.from(container.querySelectorAll("[data-testid]")) as HTMLElement[];
    fireEvent.click(within(runA!).getByRole("button", { name: /Critical/i }));

    expect(within(runA!).queryByText("Warning one")).not.toBeInTheDocument();
    expect(within(runB!).getByText("Warning one")).toBeInTheDocument();
  });
});
