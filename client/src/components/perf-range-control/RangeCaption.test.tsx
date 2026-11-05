import { describe, it, expect, afterEach } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithPerfIntl } from "@/test/agent-performance-fixtures";
import { RangeCaption } from "./RangeCaption";

afterEach(cleanup);

describe("RangeCaption (L08 skill-stats C2, R-31, R-33)", () => {
  it("names a preset with its applied start and end in the response's zone", () => {
    renderWithPerfIntl(
      <RangeCaption
        choice={{ kind: "preset", preset: "1d", at: null }}
        applied={{ from: "2026-11-04T10:37:00.000Z", to: "2026-11-05T10:37:00.000Z", tz: "UTC" }}
      />,
    );
    expect(screen.getByText("1 day · Nov 4, 10:37 – Nov 5, 10:37")).toBeInTheDocument();
  });

  it("names a custom range by its first and last day, both included; years only outside the current year (OQ-4 A)", () => {
    const custom = { kind: "custom", start: "2026-11-01", end: "2026-11-03" } as const;
    renderWithPerfIntl(
      <RangeCaption choice={custom} applied={{ from: "2026-11-01T00:00:00.000Z", to: "2026-11-04T00:00:00.000Z", tz: "UTC" }} />,
    );
    expect(screen.getByText("Nov 1 – Nov 3")).toBeInTheDocument();
    cleanup();

    renderWithPerfIntl(
      <RangeCaption
        choice={{ kind: "custom", start: "2025-12-30", end: "2026-01-02" }}
        applied={{ from: "2025-12-30T00:00:00.000Z", to: "2026-01-03T00:00:00.000Z", tz: "UTC" }}
      />,
    );
    expect(screen.getByText("Dec 30, 2025 – Jan 2, 2026")).toBeInTheDocument();
  });

  it("reads the window off `applied`, not the choice's own dates, and shows nothing without it", () => {
    // The address already says "1 day ending now"; the figures on screen are for an older window.
    renderWithPerfIntl(
      <RangeCaption
        choice={{ kind: "preset", preset: "1d", at: null }}
        applied={{ from: "2026-10-01T08:00:00.000Z", to: "2026-10-02T08:00:00.000Z", tz: "Europe/Kyiv" }}
      />,
    );
    expect(screen.getByText("1 day · Oct 1, 11:00 – Oct 2, 11:00")).toBeInTheDocument();
    cleanup();

    const { container } = renderWithPerfIntl(
      <RangeCaption choice={{ kind: "preset", preset: "30d", at: null }} applied={undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
