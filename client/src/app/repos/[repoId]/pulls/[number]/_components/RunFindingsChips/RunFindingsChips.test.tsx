/**
 * RunFindingsChips — the timeline tally that previews the run behind it.
 *
 * The contract is the same one the PR list's cell carries: hover opens after a
 * beat, a click pins the panel open, and chips with nothing behind them open
 * nothing at all. What is specific here is that the findings arrive as a prop —
 * the tab already holds them — so the panel must render without any fetch.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";
import { OPEN_DELAY_MS, CLOSE_DELAY_MS } from "@/components/findings-popover";
import { RunFindingsChips } from "./RunFindingsChips";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  cleanup();
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

function renderChips(findings: FindingRecord[]) {
  render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <RunFindingsChips
        findings={findings}
        counts={{ CRITICAL: findings.filter((f) => f.severity === "CRITICAL").length }}
        emptyFallback="0 finding(s)"
      />
    </NextIntlClientProvider>,
  );
  return screen.getByRole("button");
}

const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("RunFindingsChips", () => {
  it("previews the run's findings on hover, worst first, with no fetch", () => {
    const trigger = renderChips([
      finding({ id: "f1", severity: "SUGGESTION", title: "Nit" }),
      finding({ id: "f2", severity: "CRITICAL", title: "Blocker" }),
    ]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.mouseEnter(trigger);
    tick(OPEN_DELAY_MS);
    expect(screen.getByRole("dialog", { name: "2 findings in this run" })).toBeInTheDocument();
    expect(screen.getAllByText(/Blocker|Nit/).map((n) => n.textContent)).toEqual(["Blocker", "Nit"]);

    fireEvent.mouseLeave(trigger);
    tick(CLOSE_DELAY_MS);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("pins the preview open on a click and closes it on Escape", () => {
    const trigger = renderChips([finding({ id: "f1" })]);
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);
    tick(CLOSE_DELAY_MS);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("pins a preview the pointer opened, instead of dismissing it", () => {
    const trigger = renderChips([finding({ id: "f1" })]);
    fireEvent.mouseEnter(trigger);
    tick(OPEN_DELAY_MS);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // On a mouse, hover always wins the race to open — a click that toggled
    // would read as "dismiss" every single time.
    fireEvent.click(trigger);
    fireEvent.mouseLeave(trigger);
    tick(CLOSE_DELAY_MS);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("survives scrolling its own overflow, but not the page behind it", () => {
    const trigger = renderChips(
      Array.from({ length: 8 }, (_, i) => finding({ id: `f${i}`, title: `Finding ${i}` })),
    );
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");

    // A long run overflows the panel; reading to the bottom must not close it.
    fireEvent.scroll(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // The page behind it is another matter — the panel is anchored to a rect
    // captured when it opened, so it would drift.
    fireEvent.scroll(window);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens nothing for a run whose findings it does not have", () => {
    const trigger = renderChips([]);
    expect(screen.getByText("0 finding(s)")).toBeInTheDocument();

    fireEvent.mouseEnter(trigger);
    tick(OPEN_DELAY_MS);
    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
