/**
 * TourView — the tour page in every state (plan step 30a). `fetch` is mocked;
 * the hooks, the api client and every child component are the real ones.
 * Expected text comes from the acceptance criteria (AC-06 … AC-86).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { OnboardingTour } from "@devdigest/shared";
import onboarding from "../../../../../../../messages/en/onboarding.json";
import context from "../../../../../../../messages/en/context.json";
import common from "../../../../../../../messages/en/common.json";

// The shell has its own providers; this mock renders the breadcrumb it is given.
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children, crumb }: { children: React.ReactNode; crumb: Array<{ label: string }> }) => (
    <div>
      <nav aria-label="Breadcrumb">{crumb.map((c) => c.label).join(" › ")}</nav>
      {children}
    </div>
  ),
}));

let routeRepoId = "r1";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useParams: () => ({ repoId: routeRepoId }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/repo-context", () => ({
  useActiveRepo: () => ({
    repoId: "r1",
    repos: [{ id: "r1", full_name: "acme/payments-api" }],
    activeRepo: null,
    setRepoId: vi.fn(),
    reposLoaded: true,
  }),
  useRepoNotFound: (id: string | null) => id !== null && id !== "r1",
}));

import { TourView } from "./TourView";

const TITLES = ["Architecture overview", "Critical paths", "How to run locally", "Guided reading path", "First tasks"];

function tour(over: Partial<OnboardingTour> = {}): OnboardingTour {
  return {
    repo_id: "r1",
    full_name: "acme/payments-api",
    name: "payments-api",
    default_branch: "main",
    status: "ready",
    index_reason: null,
    revision: "abc123",
    blockers: [],
    api_key: { provider: "openrouter", model: "deepseek/deepseek-v4-flash", missing: false },
    can_generate: true,
    generation: { running: false, failure: null },
    meta: null,
    sections: {
      architecture: {
        prose: null,
        components: [],
        connections: [],
        stack: { languages: [{ name: "TypeScript", files: 3 }], frameworks: ["Fastify"], runtime: ["Node.js"] },
        folders: [{ path: "src", files: 3 }],
        gap: null,
      },
      critical_paths: { rows: [{ path: "src/a.ts", reason: null, importers: 3, top_percent: 5 }], gap: null },
      run_locally: { commands: [{ step: 1, command: "pnpm install", comment: null }], gap: null },
      reading_path: { rows: [{ path: "src/a.ts", reason: null, importers: 3, top_percent: 5 }], gap: null },
      first_tasks: { tasks: [], gap: "no_candidates" },
    },
    ...over,
  };
}

const META = {
  revision: "abc123",
  generated_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
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

const failure = (code: "no_api_key" | "timeout" | "provider_error" | "invalid_output", message: string) => ({
  code,
  message,
  provider: "openrouter",
  at: "2026-10-31T10:00:00.000Z",
});

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    statusText: status < 400 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  } as Response);

beforeEach(() => {
  fetchMock.mockReset();
  routeRepoId = "r1";
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ onboarding, context, common }} timeZone="UTC" now={new Date()}>
        <TourView />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const serve = (t: OnboardingTour) => fetchMock.mockImplementation(() => json(t));
const sectionHeadings = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
const methods = () => fetchMock.mock.calls.map((c) => ((c[1] as RequestInit | undefined)?.method ?? "GET").toUpperCase());

describe("TourView", () => {
  it("AC-06 — breadcrumb owner/name › Onboarding Tour, heading with the name in its own element", async () => {
    serve(tour());
    renderView();
    const h1 = await screen.findByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Onboarding for payments-api");
    const accent = within(h1).getByText("payments-api");
    expect(accent.tagName).not.toBe("H1");
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("acme/payments-api › Onboarding Tour");
  });

  it.each([
    ["generated", tour({ status: "generated", meta: META })],
    ["ready", tour()],
    ["not_cloned", tour({ status: "not_cloned", blockers: ["not_cloned"], can_generate: false, revision: null })],
    ["index_not_ready", tour({ status: "index_not_ready", blockers: ["index_not_ready"], index_reason: "no_data", can_generate: false })],
  ])("AC-07 — the five section titles in order (%s)", async (_s, payload) => {
    serve(payload);
    renderView();
    await screen.findByRole("heading", { level: 1 });
    expect(sectionHeadings()).toEqual(TITLES);
  });

  it("AC-17 — skeleton placeholders while loading", () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    renderView();
    // F-26: by role, not querySelector. The skeleton has no accessible name to
    // query by (see the test-writer report), so the busy state is the filter.
    expect(screen.getByRole("generic", { busy: true })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });

  it("AC-18 — a 500 shows the error state with the reason and Retry; Retry refetches", async () => {
    fetchMock.mockImplementation(() => json({ error: { code: "boom", message: "database exploded" } }, 500));
    renderView();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("database exploded");
    const before = fetchMock.mock.calls.length;
    fireEvent.click(within(alert).getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(before));
  });

  it("AC-19 — a 404 shows the repository-not-found screen", async () => {
    fetchMock.mockImplementation(() => json({ error: { code: "not_found", message: "Repo r1 not found" } }, 404));
    renderView();
    expect(await screen.findByText(common.repoNotFound.title)).toBeInTheDocument();
  });

  it("AC-19 — an id missing from the repos list shows the repository-not-found screen", async () => {
    routeRepoId = "zzz";
    serve(tour());
    renderView();
    expect(await screen.findByText(common.repoNotFound.title)).toBeInTheDocument();
  });

  it("AC-25, AC-26 — a ready tour offers Generate tour, and opening the page sends only GETs", async () => {
    serve(tour());
    renderView();
    expect(await screen.findByRole("button", { name: "Generate tour" })).toBeEnabled();
    expect(methods().every((m) => m === "GET")).toBe(true);
  });

  it("AC-71 — ready + provider_error failure → Generation failed — …", async () => {
    serve(tour({ generation: { running: false, failure: failure("provider_error", "quota exceeded") } }));
    renderView();
    expect(await screen.findByText(/^Generation failed — /)).toHaveTextContent("quota exceeded");
  });

  it("AC-70 — no_api_key failure → No API key for openrouter + a Settings link, once even with the blocker", async () => {
    serve(
      tour({
        blockers: ["no_api_key"],
        can_generate: false,
        api_key: { provider: "openrouter", model: "m", missing: true },
        generation: { running: false, failure: failure("no_api_key", "No API key for openrouter") },
      }),
    );
    renderView();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getAllByText(/No API key for openrouter/)).toHaveLength(1);
    expect(screen.getByRole("link", { name: /API Keys/ })).toHaveAttribute("href", "/settings/api-keys");
  });

  it("AC-86 — on open, a missing key shows the status, the Settings link, and disables Generate tour", async () => {
    serve(tour({ blockers: ["no_api_key"], can_generate: false, api_key: { provider: "openrouter", model: "m", missing: true } }));
    renderView();
    expect(await screen.findByText(/No API key for openrouter/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /API Keys/ })).toHaveAttribute("href", "/settings/api-keys");
    expect(screen.getByRole("button", { name: "Generate tour" })).toBeDisabled();
    expect(methods().every((m) => m === "GET")).toBe(true);
  });

  it("AC-86 — generated + no_api_key → Regenerate disabled", async () => {
    serve(tour({ status: "generated", meta: META, blockers: ["no_api_key"], can_generate: false, api_key: { provider: "openrouter", model: "m", missing: true } }));
    renderView();
    expect(await screen.findByRole("button", { name: "Regenerate" })).toBeDisabled();
  });

  it("AC-86, D-41 — not_cloned + no_api_key → both lines, the not-cloned one first", async () => {
    serve(tour({ status: "not_cloned", blockers: ["not_cloned", "no_api_key"], can_generate: false, revision: null, api_key: { provider: "openrouter", model: "m", missing: true } }));
    renderView();
    const notCloned = await screen.findByText("Not cloned — clone to generate");
    const noKey = screen.getByText(/No API key for openrouter/);
    expect(notCloned.compareDocumentPosition(noKey) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("AC-72 — invalid_output → Generation failed — the model returned invalid output", async () => {
    serve(tour({ generation: { running: false, failure: failure("invalid_output", "the model returned invalid output") } }));
    renderView();
    expect(await screen.findByText("Generation failed — the model returned invalid output")).toBeInTheDocument();
  });

  it("AC-73 — generated + failure → the stored sections stay, plus a dismissible Regeneration failed notice", async () => {
    serve(tour({ status: "generated", meta: META, generation: { running: false, failure: failure("timeout", "timed out") } }));
    renderView();
    const notice = await screen.findByRole("alert");
    expect(notice).toHaveTextContent(/^Regeneration failed — /);
    expect(sectionHeadings()).toEqual(TITLES);
    expect(screen.getAllByText("src/a.ts").length).toBeGreaterThan(0);
    fireEvent.click(within(notice).getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/^Regeneration failed — /)).toBeNull();
  });

  it("AC-27 — clicking Generate tour sends exactly one POST …/tour/generate", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === "POST" ? json({ running: true }, 202) : json(tour()),
    );
    renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Generate tour" }));
    await waitFor(() => expect(methods().filter((m) => m === "POST")).toHaveLength(1));
    const post = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST")!;
    expect(String(post[0])).toMatch(/\/repos\/r1\/tour\/generate$/);
  });

  it("AC-15 — index_not_ready with reason no_files → Index not ready — <reason>, Generate disabled", async () => {
    serve(tour({ status: "index_not_ready", blockers: ["index_not_ready"], index_reason: "no_files", can_generate: false }));
    renderView();
    expect(await screen.findByText("Index not ready — the index holds no files")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate tour" })).toBeDisabled();
  });

  it("AC-80 — the On this page aside carries the lg-only visibility classes (jsdom has no media queries)", async () => {
    serve(tour());
    renderView();
    await screen.findByRole("heading", { level: 1 });
    const aside = screen.getByRole("complementary");
    expect(aside).toContainElement(screen.getByRole("navigation", { name: "On this page" }));
    expect(aside).toHaveClass("hidden", "lg:block");
  });

  it("AC-58 — the no-clone payload: open-PR tasks, and the other four sections say they need a clone", async () => {
    serve(
      tour({
        status: "not_cloned",
        blockers: ["not_cloned"],
        can_generate: false,
        revision: null,
        sections: {
          architecture: { prose: null, components: [], connections: [], stack: { languages: [], frameworks: [], runtime: [] }, folders: [], gap: "needs_clone" },
          critical_paths: { rows: [], gap: "needs_clone" },
          run_locally: { commands: [], gap: "needs_clone" },
          reading_path: { rows: [], gap: "needs_clone" },
          first_tasks: {
            tasks: [
              { candidate_id: "open-pr:7", kind: "open-pr", source: "fallback", title: null, reason: null, path: null, line: null, pr_number: 7, pr_title: "Fix login", detail: "marisa", importers: null, top_percent: null },
            ],
            gap: null,
          },
        },
      }),
    );
    renderView();
    expect(await screen.findByText("Review PR #7: Fix login")).toBeInTheDocument();
    expect(screen.getAllByText("Needs a clone and an index")).toHaveLength(4);
  });
});
