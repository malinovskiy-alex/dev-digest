import { describe, it, expect, afterEach } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import type { FindingsBreakdown } from "@devdigest/shared";
import { EMPTY_FINDINGS, findingsBreakdown, renderWithPerfIntl } from "@/test/agent-performance-fixtures";
import { FindingsWidget } from "./FindingsWidget";

afterEach(cleanup);

const EMPTY_LABEL = "No findings in the last 30 days";

function only(total: number, over: Partial<FindingsBreakdown> = {}): FindingsBreakdown {
  return {
    total,
    by_category: { ...EMPTY_FINDINGS.by_category, security: total },
    by_severity: { ...EMPTY_FINDINGS.by_severity, WARNING: total },
    ...over,
  };
}

/** The legend / severity entries as "<label> <count · p%>" lines, in DOM order. */
function lines(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole("listitem")
    .map((li) => li.textContent!.replace(/(\D)(\d+ ·)/, "$1 $2"));
}

describe("FindingsWidget (L08 skill-stats C1)", () => {
  it("shows the ring with the total, the fixed legend and severity order with zeros, and per-entry percentages (R-60 … R-63, R-66)", () => {
    // 1 of 3 each → 33% three times (sum 99, allowed by R-62); no "other".
    renderWithPerfIntl(
      <FindingsWidget
        findings={{
          total: 3,
          by_category: { security: 1, bug: 1, perf: 1, style: 0, test: 0, other: 0 },
          by_severity: { CRITICAL: 1, WARNING: 1, SUGGESTION: 1, other: 0 },
        }}
        emptyLabel={EMPTY_LABEL}
      />,
    );
    const ring = screen.getByRole("img", { name: "Findings by category" });
    expect(within(ring).getByText("3")).toBeInTheDocument();

    const [legend, severity] = screen.getAllByRole("list") as [HTMLElement, HTMLElement];
    expect(lines(legend)).toEqual([
      "security 1 · 33%",
      "bug 1 · 33%",
      "perf 1 · 33%",
      "style 0 · 0%",
      "test 0 · 0%",
    ]);
    expect(severity).toHaveAccessibleName("Findings by severity");
    expect(lines(severity)).toEqual(["CRITICAL 1 · 33%", "WARNING 1 · 33%", "SUGGESTION 1 · 33%"]);
    expect(screen.getByText("Small sample")).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_LABEL)).not.toBeInTheDocument();
  });

  it("lists `other` only when above 0, on both axes (R-61, R-63)", () => {
    renderWithPerfIntl(
      <FindingsWidget
        findings={findingsBreakdown({
          total: 13,
          by_category: { security: 5, bug: 4, perf: 1, style: 1, test: 0, other: 2 },
          by_severity: { CRITICAL: 3, WARNING: 6, SUGGESTION: 3, other: 1 },
        })}
        emptyLabel={EMPTY_LABEL}
      />,
    );
    const [legend, severity] = screen.getAllByRole("list") as [HTMLElement, HTMLElement];
    expect(lines(legend).at(-1)).toBe("other 2 · 15%");
    expect(lines(severity).at(-1)).toBe("other 1 · 8%");
    expect(screen.queryByText("Small sample")).not.toBeInTheDocument();
  });

  it("shows 'Small sample' for 1 and 4 findings, not for 5 (R-64)", () => {
    for (const [total, shown] of [[1, true], [4, true], [5, false]] as const) {
      renderWithPerfIntl(<FindingsWidget findings={only(total)} emptyLabel={EMPTY_LABEL} />);
      expect(!!screen.queryByText("Small sample")).toBe(shown);
      cleanup();
    }
  });

  it("shows only the empty sentence at 0 findings (R-65)", () => {
    renderWithPerfIntl(<FindingsWidget findings={EMPTY_FINDINGS} emptyLabel={EMPTY_LABEL} />);
    expect(screen.getByText(EMPTY_LABEL)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText("Small sample")).not.toBeInTheDocument();
  });

  it("gives each category one fixed colour, the same on every render (R-67)", () => {
    const swatches = () =>
      within(screen.getAllByRole("list")[0]!)
        .getAllByRole("listitem")
        .map((li) => (li.firstElementChild as HTMLElement).style.background);
    renderWithPerfIntl(<FindingsWidget findings={findingsBreakdown()} emptyLabel={EMPTY_LABEL} />);
    const first = swatches();
    cleanup();
    renderWithPerfIntl(<FindingsWidget findings={findingsBreakdown()} emptyLabel={EMPTY_LABEL} />);
    expect(swatches()).toEqual(first);
    // security red, bug orange, perf purple, style blue, test green
    expect(first).toEqual([
      "rgb(239, 68, 68)",
      "rgb(249, 115, 22)",
      "rgb(139, 92, 246)",
      "rgb(59, 130, 246)",
      "rgb(16, 185, 129)",
    ]);
  });
});
