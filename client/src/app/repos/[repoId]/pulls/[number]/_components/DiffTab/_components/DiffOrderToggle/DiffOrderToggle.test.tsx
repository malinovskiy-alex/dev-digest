import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import prReview from "../../../../../../../../../../messages/en/prReview.json";
import { DiffOrderToggle } from "./DiffOrderToggle";

afterEach(cleanup);

function renderToggle(props: Partial<React.ComponentProps<typeof DiffOrderToggle>> = {}) {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={{ prReview }}>
      <DiffOrderToggle value="smart" onChange={onChange} {...props} />
    </NextIntlClientProvider>,
  );
  return onChange;
}

describe("DiffOrderToggle", () => {
  it("marks the current order pressed and reports a switch to the other", () => {
    const onChange = renderToggle({ value: "smart" });
    expect(screen.getByRole("group", { name: "Diff order" })).toBeInTheDocument();
    const smart = screen.getByRole("button", { name: "Smart order" });
    const original = screen.getByRole("button", { name: "Original order" });
    expect(smart).toHaveAttribute("aria-pressed", "true");
    expect(original).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(original);
    expect(onChange).toHaveBeenCalledWith("original");
  });

  it("follows the value prop and can be disabled", () => {
    renderToggle({ value: "original", disabled: true });
    expect(screen.getByRole("button", { name: "Original order" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Smart order" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Smart order" })).toBeDisabled();
  });
});
