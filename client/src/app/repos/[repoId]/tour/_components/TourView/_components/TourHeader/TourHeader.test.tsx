/**
 * TourHeader — the header line, its tooltip and badges, the Generate /
 * Regenerate button and Share link (plan step 30a). Expected text comes from
 * AC-12, AC-13, AC-14, AC-16, AC-28, AC-69, AC-74, AC-75, AC-84.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { OnboardingTour, TourMeta } from "@devdigest/shared";
import onboarding from "../../../../../../../../../messages/en/onboarding.json";
import { TourHeader } from "./TourHeader";

const NOW = new Date("2026-10-31T12:00:00.000Z");

const META: TourMeta = {
  revision: "abc123",
  generated_at: "2026-10-31T10:00:00.000Z",
  index_files: 4200,
  source_files: 12450,
  coverage_partial: false,
  index_partial: false,
  trimmed: false,
  provider: "openrouter",
  model: "deepseek/deepseek-v4-flash",
  cost_usd: 0.0021,
  outdated: false,
};

function tour(over: Partial<OnboardingTour> = {}, meta: Partial<TourMeta> | null = {}): OnboardingTour {
  const t: OnboardingTour = {
    repo_id: "r1",
    full_name: "acme/payments-api",
    name: "payments-api",
    default_branch: "main",
    status: meta ? "generated" : "ready",
    index_reason: null,
    revision: "abc123",
    blockers: [],
    api_key: { provider: "openrouter", model: "m", missing: false },
    can_generate: true,
    generation: { running: false, failure: null },
    meta: meta ? { ...META, ...meta } : null,
    sections: {} as OnboardingTour["sections"],
  };
  return { ...t, ...over };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderHeader(t: OnboardingTour, onGenerate = vi.fn(), indexReasonText: string | null = null) {
  render(
    <NextIntlClientProvider locale="en" messages={{ onboarding }} timeZone="UTC" now={NOW}>
      <TourHeader tour={t} indexReasonText={indexReasonText} generating={false} onGenerate={onGenerate} />
    </NextIntlClientProvider>,
  );
  return onGenerate;
}

describe("TourHeader", () => {
  it("AC-12 — Generated from index of 4,200 files · last refreshed <relative time>", () => {
    renderHeader(tour());
    expect(screen.getByText("Generated from index of 4,200 files · last refreshed 2 hours ago")).toBeInTheDocument();
  });

  it("AC-13 — partial coverage → N of M source files indexed instead of N files", () => {
    renderHeader(tour({}, { coverage_partial: true }));
    const line = screen.getByText(/4,200 of 12,450 source files indexed/);
    expect(line).toBeInTheDocument();
    expect(line.textContent).not.toMatch(/4,200 files/);
  });

  it("AC-84 — the line's tooltip names provider, model and cost; a null cost reads cost unknown", () => {
    renderHeader(tour());
    const title = screen.getByText(/Generated from index of/).getAttribute("title") ?? "";
    expect(title).toContain("openrouter");
    expect(title).toContain("deepseek/deepseek-v4-flash");
    expect(title).toContain("$0.0021");
    cleanup();
    renderHeader(tour({}, { cost_usd: null }));
    expect(screen.getByText(/Generated from index of/).getAttribute("title")).toContain("cost unknown");
  });

  it("AC-16, AC-69 — partial index and trimmed fact set badges", () => {
    renderHeader(tour({}, { index_partial: true, trimmed: true }));
    expect(screen.getByText("partial index")).toBeInTheDocument();
    expect(screen.getByText("built from a trimmed fact set")).toBeInTheDocument();
    cleanup();
    renderHeader(tour());
    expect(screen.queryByText("partial index")).toBeNull();
    expect(screen.queryByText("built from a trimmed fact set")).toBeNull();
  });

  it("AC-74 — outdated → the Outdated text next to Regenerate, and nothing regenerates on render", () => {
    const onGenerate = renderHeader(tour({}, { outdated: true }));
    expect(screen.getByText("Outdated — the repository has changed since this tour was generated")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeEnabled();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("AC-27 — clicking Regenerate starts one generation", () => {
    const onGenerate = renderHeader(tour());
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("AC-28 — while running the button reads Generating… and is disabled", () => {
    renderHeader(tour({ generation: { running: true, failure: null }, can_generate: false }));
    expect(screen.getByRole("button", { name: "Generating…" })).toBeDisabled();
  });

  it("AC-14 — not cloned → status line, Generate tour disabled, tooltip names the requirement", () => {
    renderHeader(tour({ status: "not_cloned", blockers: ["not_cloned"], can_generate: false, revision: null }, null));
    expect(screen.getByText("Not cloned — clone to generate")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Generate tour" });
    expect(button).toBeDisabled();
    expect(screen.getByTitle("A clone and an index are required")).toContainElement(button);
  });

  it("AC-15 — index not ready → Index not ready — <reason>, disabled", () => {
    renderHeader(tour({ status: "index_not_ready", blockers: ["index_not_ready"], can_generate: false }, null), vi.fn(), "the index holds no files");
    expect(screen.getByText("Index not ready — the index holds no files")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate tour" })).toBeDisabled();
  });

  it("AC-75 — Share link copies <origin>/repos/<id>/tour", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    renderHeader(tour());
    fireEvent.click(screen.getByRole("button", { name: "Copy a link to this tour" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/repos/r1/tour`));
    expect(screen.getByRole("button", { name: "Copy a link to this tour" })).toHaveTextContent("Share link");
  });
});

/*
 * Regression for finding F-21 (AC-12): the "last refreshed <relative time>" was
 * formatted without an explicit `now`. With no `now` on the provider — as in
 * the app — next-intl then reports ENVIRONMENT_FALLBACK through `onError` on
 * every render and the text never moves. Here the provider gets no `now`, the
 * clock is faked, and `onError` is recorded.
 */
describe("TourHeader — relative time (F-21, AC-12)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("F-21, AC-12 — relative time is measured against a ticking now, and no IntlError is reported", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW); // two hours after META.generated_at
    const onError = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={{ onboarding }} timeZone="UTC" onError={onError}>
        <TourHeader tour={tour()} indexReasonText={null} generating={false} onGenerate={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Generated from index of 4,200 files · last refreshed 2 hours ago")).toBeInTheDocument();

    // AC-12: the time is relative to now, so it must move as time passes.
    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1000);
    });
    expect(screen.getByText("Generated from index of 4,200 files · last refreshed 3 hours ago")).toBeInTheDocument();

    expect(onError).not.toHaveBeenCalled();
  });
});
