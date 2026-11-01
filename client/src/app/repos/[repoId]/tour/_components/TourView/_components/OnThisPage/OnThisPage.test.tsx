/**
 * OnThisPage — the five entries, jump + focus, and the scroll-tracked current
 * entry (plan step 30a). Rendered beside real TourSections so the headings it
 * focuses and measures exist. Expected behaviour from AC-08, AC-09, AC-81.
 */
import { describe, it, expect, afterEach, vi, onTestFinished } from "vitest";
import { render, screen, cleanup, fireEvent, act, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import onboarding from "../../../../../../../../../messages/en/onboarding.json";
import { TourSection } from "../TourSection";
import { OnThisPage } from "./OnThisPage";
import { activeSection } from "./helpers";

const ITEMS = [
  { id: "tour-architecture", title: "Architecture overview" },
  { id: "tour-critical-paths", title: "Critical paths" },
  { id: "tour-run-locally", title: "How to run locally" },
  { id: "tour-reading-path", title: "Guided reading path" },
  { id: "tour-first-tasks", title: "First tasks" },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ onboarding }}>
      <div>
        {ITEMS.map((i) => (
          <TourSection key={i.id} id={i.id} title={i.title}>
            <p>{i.title} body</p>
          </TourSection>
        ))}
      </div>
      <OnThisPage items={ITEMS} />
    </NextIntlClientProvider>,
  );
}

const nav = () => screen.getByRole("navigation", { name: "On this page" });
// F-26: role queries, scoped to the nav — never querySelector.
const entries = () => within(nav()).getAllByRole("button");

describe("OnThisPage", () => {
  it("AC-08 — five entries in section order", () => {
    renderPage();
    expect(entries().map((b) => b.textContent)).toEqual(ITEMS.map((i) => i.title));
  });

  it("AC-09 — activating an entry scrolls its section into view and focuses its heading", () => {
    // jsdom has no scrollIntoView: define a placeholder only when absent, then
    // spy on it, so restoreAllMocks puts the prototype back (F-26).
    const hadScroll = "scrollIntoView" in Element.prototype;
    if (!hadScroll) Element.prototype.scrollIntoView = function () {};
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
    onTestFinished(() => {
      if (!hadScroll) delete (Element.prototype as Partial<Element>).scrollIntoView;
    });
    renderPage();
    fireEvent.click(entries()[3]!);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById("tour-reading-path"));
    expect(screen.getByRole("heading", { name: "Guided reading path" })).toHaveFocus();
    expect(entries()[3]).toHaveAttribute("aria-current", "true");
  });

  it("AC-81 — activeSection picks the heading closest to the top", () => {
    expect(activeSection([{ id: "a", top: -400 }, { id: "b", top: 30 }, { id: "c", top: 500 }])).toBe("b");
    expect(activeSection([{ id: "a", top: -10 }, { id: "b", top: 300 }])).toBe("a");
    expect(activeSection([])).toBeNull();
  });

  it("AC-81 — a scroll event moves aria-current to the section nearest the top", () => {
    const tops: Record<string, number> = {
      "tour-architecture-heading": 0,
      "tour-critical-paths-heading": 400,
      "tour-run-locally-heading": 800,
      "tour-reading-path-heading": 1200,
      "tour-first-tasks-heading": 1600,
    };
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      return { top: tops[this.id] ?? 9999 } as DOMRect;
    });
    renderPage();
    expect(entries()[0]).toHaveAttribute("aria-current", "true");
    for (const k of Object.keys(tops)) tops[k]! -= 790; // run-locally is now ~10 px from the top
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(entries()[2]).toHaveAttribute("aria-current", "true");
    expect(entries()[0]).not.toHaveAttribute("aria-current");
  });
});
