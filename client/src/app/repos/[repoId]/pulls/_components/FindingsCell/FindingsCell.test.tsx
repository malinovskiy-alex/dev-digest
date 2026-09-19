/**
 * FindingsCell — the hover trigger in the PR list's Findings column.
 *
 * Two things must hold. A click pins the preview open — that is the only way
 * in on a touchscreen, where there is no hover at all — and interacting with
 * the chips must never navigate: the whole row routes to the PR detail page,
 * and a click that slips through would take the reader somewhere they did not
 * ask to go.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrMeta } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/prReview.json";

const usePrReviews = vi.fn(() => ({ data: [], isLoading: false, isError: false }));
vi.mock("@/lib/hooks/reviews", () => ({ usePrReviews: () => usePrReviews() }));

import { FindingsCell } from "./FindingsCell";
import { CLOSE_DELAY_MS, OPEN_DELAY_MS } from "@/components/findings-popover";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function pr(o: Partial<PrMeta> = {}): PrMeta {
  return {
    id: "pr-1",
    number: 482,
    title: "Add rate limiting",
    author: "marisa.koch",
    branch: "feat/rate-limit",
    base: "main",
    head_sha: "abc1234",
    additions: 247,
    deletions: 38,
    files_count: 9,
    status: "needs_review",
    findings: { CRITICAL: 2, WARNING: 1, SUGGESTION: 0 },
    ...o,
  };
}

function renderCell(meta: PrMeta = pr(), onRowClick = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <div onClick={onRowClick}>
        <FindingsCell pr={meta} />
      </div>
    </NextIntlClientProvider>,
  );
  return { onRowClick, trigger: screen.getByRole("button") };
}

const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("FindingsCell", () => {
  it("shows the severity split without hovering", () => {
    renderCell();
    expect(screen.getByTitle("2 Critical")).toBeInTheDocument();
    expect(screen.getByTitle("1 Warning")).toBeInTheDocument();
  });

  it("opens the preview on hover, and closes it when the pointer leaves", () => {
    const { trigger } = renderCell();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.mouseEnter(trigger);
    tick(OPEN_DELAY_MS);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.mouseLeave(trigger);
    tick(CLOSE_DELAY_MS);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not open on a passing pointer", () => {
    const { trigger } = renderCell();
    fireEvent.mouseEnter(trigger);
    tick(OPEN_DELAY_MS - 20);
    fireEvent.mouseLeave(trigger);
    tick(OPEN_DELAY_MS + CLOSE_DELAY_MS);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("never navigates the row it sits in", () => {
    const { trigger, onRowClick } = renderCell();
    fireEvent.click(trigger);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("opens on keyboard focus and closes on Escape", () => {
    const { trigger } = renderCell();
    fireEvent.focus(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("pins the preview open on a click, so a touch has a way in", () => {
    const { trigger, onRowClick } = renderCell();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onRowClick).not.toHaveBeenCalled();

    // A pinned panel is deliberate: the pointer leaving must not take it away.
    fireEvent.mouseLeave(trigger);
    tick(CLOSE_DELAY_MS);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes a pinned preview on a second click", () => {
    const { trigger } = renderCell();
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes a pinned preview when the next click lands outside it", () => {
    const { trigger } = renderCell();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    act(() => void fireEvent.mouseDown(document.body));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has nothing to preview when the PR has no findings", () => {
    const { trigger } = renderCell(pr({ findings: { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 } }));
    expect(screen.getByText("—")).toBeInTheDocument();
    fireEvent.mouseEnter(trigger);
    tick(OPEN_DELAY_MS);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
