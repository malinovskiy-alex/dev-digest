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
import { activeSection, scrolledToEnd } from "./helpers";

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

  // F-38 (AC-81): in the app the shell scrolls its own <main>, not the window,
  // and that container starts below the top bar. The current entry must follow
  // the container's scroll events, measured from the container's top edge.
  const CONTAINER_TOP = 300; // the shell's top bar sits above the scroller

  function renderInScroller() {
    render(
      <NextIntlClientProvider locale="en" messages={{ onboarding }}>
        <main style={{ overflowY: "auto" }}>
          {ITEMS.map((i) => (
            <TourSection key={i.id} id={i.id} title={i.title}>
              <p>{i.title} body</p>
            </TourSection>
          ))}
          <OnThisPage items={ITEMS} />
        </main>
      </NextIntlClientProvider>,
    );
    return screen.getByRole("main");
  }

  /** Heading tops relative to the container; reported to the DOM in viewport coordinates. */
  function mockTops(relative: Record<string, number>) {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      if (this.tagName === "MAIN") return { top: CONTAINER_TOP } as DOMRect;
      return { top: (relative[this.id] ?? 99_999) + CONTAINER_TOP } as DOMRect;
    });
  }

  function setScroll(el: HTMLElement, scrollTop: number, clientHeight: number, scrollHeight: number) {
    Object.defineProperty(el, "scrollTop", { value: scrollTop, configurable: true });
    Object.defineProperty(el, "clientHeight", { value: clientHeight, configurable: true });
    Object.defineProperty(el, "scrollHeight", { value: scrollHeight, configurable: true });
  }

  it("F-38, AC-81 — a scroll of the scrolling ancestor (not the window) moves the current entry, measured from its top", () => {
    const tops: Record<string, number> = {
      "tour-architecture-heading": 0,
      "tour-critical-paths-heading": 400,
      "tour-run-locally-heading": 800,
      "tour-reading-path-heading": 1200,
      "tour-first-tasks-heading": 1600,
    };
    mockTops(tops);
    const main = renderInScroller();
    setScroll(main, 0, 800, 3000);
    expect(entries()[0]).toHaveAttribute("aria-current", "true");

    // run-locally is now 10 px below the container's top (viewport 310); by
    // viewport coordinates critical-paths (viewport -90) would be nearest 0.
    for (const k of Object.keys(tops)) tops[k]! -= 790;
    setScroll(main, 790, 800, 3000);
    act(() => {
      main.dispatchEvent(new Event("scroll"));
    });
    expect(entries()[2]).toHaveAttribute("aria-current", "true");
    expect(entries()[1]).not.toHaveAttribute("aria-current");
  });

  it("F-38, AC-81 — scrolled to the end, the last section is current even though its heading never reaches the top", async () => {
    // reading-path sits exactly at the top; first-tasks is short and stays 400 px down
    const tops: Record<string, number> = {
      "tour-architecture-heading": -2000,
      "tour-critical-paths-heading": -1400,
      "tour-run-locally-heading": -800,
      "tour-reading-path-heading": 0,
      "tour-first-tasks-heading": 400,
    };
    mockTops(tops);
    const main = renderInScroller();

    setScroll(main, 1500, 800, 3000); // not at the end (control)
    act(() => {
      main.dispatchEvent(new Event("scroll"));
    });
    expect(entries()[3]).toHaveAttribute("aria-current", "true");
    // scroll handling is throttled to one measurement per frame (F-24): let the
    // frame pass so the next scroll event is measured, not dropped
    await act(() => new Promise<void>((r) => window.requestAnimationFrame(() => r())));

    setScroll(main, 2200, 800, 3000); // 2200 + 800 = 3000: the end
    act(() => {
      main.dispatchEvent(new Event("scroll"));
    });
    expect(entries()[4]).toHaveAttribute("aria-current", "true");
    expect(entries()[3]).not.toHaveAttribute("aria-current");
  });

  it("F-38 — scrolledToEnd: at the end (within 2 px) only when the range actually scrolls", () => {
    expect(scrolledToEnd(2200, 800, 3000)).toBe(true);
    expect(scrolledToEnd(2199, 800, 3000)).toBe(true);
    expect(scrolledToEnd(1500, 800, 3000)).toBe(false);
    expect(scrolledToEnd(0, 800, 800)).toBe(false); // nothing to scroll
    expect(activeSection([{ id: "a", top: 0 }, { id: "b", top: 400 }], true)).toBe("b");
    expect(activeSection([], true)).toBeNull();
  });
});
