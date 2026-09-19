/**
 * SeverityChips — the shared severity tally. Two contracts matter here:
 * a bucket with no findings is never drawn at all, and a chip is only ever
 * interactive when a caller passes `onToggle` (the PR list and the timeline
 * must not hand the user something that looks clickable and isn't).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SeverityChips } from "./SeverityChips";
import { countBySeverity, totalOf } from "./helpers";

afterEach(cleanup);

describe("SeverityChips", () => {
  it("renders only the severities that actually occur", () => {
    render(<SeverityChips counts={{ CRITICAL: 2, SUGGESTION: 1 }} onToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: /2\s*Critical/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1\s*Suggestion/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Warning/i })).not.toBeInTheDocument();
  });

  it("renders the empty fallback when every bucket is zero", () => {
    render(
      <SeverityChips counts={{ CRITICAL: 0, WARNING: 0, SUGGESTION: 0 }} emptyFallback="—" />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("is read-only without onToggle — nothing focusable", () => {
    render(<SeverityChips counts={{ CRITICAL: 2, WARNING: 1 }} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByTitle("2 Critical")).toBeInTheDocument();
  });

  it("reports the clicked severity and marks the active chip pressed", () => {
    const onToggle = vi.fn();
    render(<SeverityChips counts={{ CRITICAL: 2, WARNING: 1 }} active="WARNING" onToggle={onToggle} />);
    const warning = screen.getByRole("button", { name: /1\s*Warning/i });
    expect(warning).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /2\s*Critical/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    fireEvent.click(warning);
    expect(onToggle).toHaveBeenCalledWith("WARNING");
  });
});

describe("countBySeverity", () => {
  it("groups findings and ignores a severity the contract cannot emit", () => {
    expect(
      countBySeverity([
        { severity: "CRITICAL" },
        { severity: "CRITICAL" },
        { severity: "SUGGESTION" },
        { severity: "INFO" },
      ]),
    ).toEqual({ CRITICAL: 2, SUGGESTION: 1 });
  });

  it("totals across buckets, treating no counts as zero", () => {
    expect(totalOf({ CRITICAL: 2, WARNING: 1 })).toBe(3);
    expect(totalOf(null)).toBe(0);
  });
});
