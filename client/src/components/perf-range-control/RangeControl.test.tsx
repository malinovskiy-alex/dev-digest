import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import agentPerformance from "../../../messages/en/agentPerformance.json";
import { renderWithPerfIntl } from "@/test/agent-performance-fixtures";
import { todayLocal, type PerfRangeChoice } from "@/lib/perf-range";
import { RangeControl } from "./RangeControl";

afterEach(cleanup);

function dayOffset(days: number): string {
  const d = new Date();
  return todayLocal(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

describe("RangeControl", () => {
  it("offers three choices and applies a preset at once (R-32)", () => {
    const onApply = vi.fn();
    renderWithPerfIntl(<RangeControl choice={{ kind: "preset", preset: "30d", at: null }} onApply={onApply} />);
    const group = screen.getByRole("group", { name: "Range" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30 days" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "1 day" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Custom range" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "1 day" }));
    expect(onApply).toHaveBeenCalledWith({ kind: "preset", preset: "1d", at: null });
  });

  it("validates a custom range before applying it (R-36, R-37)", () => {
    const onApply = vi.fn();
    renderWithPerfIntl(<RangeControl choice={{ kind: "preset", preset: "30d", at: null }} onApply={onApply} />);
    fireEvent.click(screen.getByRole("button", { name: "Custom range" }));
    const start = screen.getByLabelText("Start date");
    const end = screen.getByLabelText("End date");

    fireEvent.change(start, { target: { value: dayOffset(-2) } });
    fireEvent.change(end, { target: { value: dayOffset(-5) } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByRole("alert")).toHaveTextContent("End date must be on or after the start date");
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.change(end, { target: { value: dayOffset(1) } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Dates after today are not available");
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.change(end, { target: { value: dayOffset(0) } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onApply).toHaveBeenCalledWith({ kind: "custom", start: dayOffset(-2), end: dayOffset(0) });
  });

  it("rejects a range whose previous window would start before 1970, and bounds the inputs (F-08)", () => {
    const onApply = vi.fn();
    renderWithPerfIntl(<RangeControl choice={{ kind: "preset", preset: "30d", at: null }} onApply={onApply} />);
    fireEvent.click(screen.getByRole("button", { name: "Custom range" }));
    const start = screen.getByLabelText("Start date");
    const end = screen.getByLabelText("End date");
    expect(start).toHaveAttribute("min", "1970-01-01");
    expect(end).toHaveAttribute("min", "1970-01-01");

    fireEvent.change(start, { target: { value: "1970-01-05" } });
    fireEvent.change(end, { target: { value: "1970-02-05" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Dates this early are not available");
    expect(onApply).not.toHaveBeenCalled();
  });

  it("follows the applied choice when it changes while mounted — back/forward, a link (F-12)", () => {
    const onApply = vi.fn();
    const ui = (choice: PerfRangeChoice) => (
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ agentPerformance }}>
        <RangeControl choice={choice} onApply={onApply} />
      </NextIntlClientProvider>
    );
    const view = render(ui({ kind: "preset", preset: "30d", at: null }));
    const pressed = () =>
      screen.getAllByRole("button", { pressed: true }).map((b) => b.textContent);

    // Open the custom form with a draft, then the address moves to "1 day" from outside.
    fireEvent.click(screen.getByRole("button", { name: "Custom range" }));
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: dayOffset(-3) } });
    view.rerender(ui({ kind: "preset", preset: "1d", at: null }));
    expect(pressed()).toEqual(["1 day"]);
    expect(screen.queryByLabelText("Start date")).not.toBeInTheDocument();

    // A custom range arrives from outside: the form opens with its dates.
    view.rerender(ui({ kind: "custom", start: dayOffset(-7), end: dayOffset(-1) }));
    expect(pressed()).toEqual(["Custom range"]);
    expect(screen.getByLabelText("Start date")).toHaveValue(dayOffset(-7));
    expect(screen.getByLabelText("End date")).toHaveValue(dayOffset(-1));

    // And back to the default.
    view.rerender(ui({ kind: "preset", preset: "30d", at: null }));
    expect(pressed()).toEqual(["30 days"]);
    expect(screen.queryByLabelText("End date")).not.toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });
});
