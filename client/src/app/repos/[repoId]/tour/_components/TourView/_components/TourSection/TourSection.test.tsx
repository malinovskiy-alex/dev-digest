/**
 * TourSection — open on load, a named collapse toggle whose state assistive
 * technology can read (plan step 30a, AC-10, AC-11).
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import onboarding from "../../../../../../../../../messages/en/onboarding.json";
import { TourSection } from "./TourSection";

afterEach(cleanup);

describe("TourSection", () => {
  it("AC-10, AC-11 — starts expanded; the toggle, named after the title, collapses and re-expands it", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ onboarding }}>
        <TourSection id="tour-critical-paths" title="Critical paths">
          <p>the body text</p>
        </TourSection>
      </NextIntlClientProvider>,
    );
    const toggle = screen.getByRole("button", { name: /Critical paths/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("the body text")).toBeVisible();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAccessibleName(/Critical paths/);
    expect(screen.getByText("the body text")).not.toBeVisible();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("the body text")).toBeVisible();
  });
});
