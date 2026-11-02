/**
 * PrBriefCard — plan step 25a. Expected values come from the requirements
 * (R-02 … R-08, R-25, R-28, R-36, R-39, R-46, R-48, R-51, R-52, R-61, R-62,
 * R-68, R-71), the plan's D-25/D-26/D-28/D-34 and the review fixes F-10,
 * F-13, F-16. The real hooks run over a mocked `fetch` (no API).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PrBrief, PrBriefView } from "@devdigest/shared";
import brief from "../../../../../../../../messages/en/brief.json";
import prReview from "../../../../../../../../messages/en/prReview.json";
import shell from "../../../../../../../../messages/en/shell.json";
import common from "../../../../../../../../messages/en/common.json";
import { PrBriefCard } from "./PrBriefCard";

// ---- fixtures -------------------------------------------------------------

const NOW = new Date("2026-11-01T12:00:00.000Z");
const HEAD = "abc1234def5678";

const BRIEF: PrBrief = {
  summary: "Adds a webhook signature check so forged events are rejected.",
  intent: null,
  blast: null,
  risks: { risks: [] },
  review_focus: [
    { file: "src/api/public/webhooks.ts", line: 61, reason: "Signature compare must be constant-time." },
    { file: "src/billing/invoice.ts", line: 7, reason: "Called from the webhook path." },
  ],
  history: null,
  meta: {
    head_sha: HEAD,
    generated_at: "2026-11-01T10:00:00.000Z", // 2 hours before NOW
    provider: "openai",
    model: "gpt-4.1",
    tokens_in: 3100,
    tokens_out: 420,
    cost_usd: 0.0142,
    missing_inputs: [],
    trim: {
      specs_removed: [],
      description: "kept",
      callers_removed: 0,
      issue_body: "kept",
      diff_rows_removed: 0,
      focus_lines_moved: 0,
      input_tokens: 2900,
    },
    dropped: { risks: 0, risk_refs: 0, review_focus: 0 },
  },
};

const withMeta = (m: Partial<PrBrief["meta"]>, o: Partial<PrBrief> = {}): PrBrief => ({
  ...BRIEF,
  ...o,
  meta: { ...BRIEF.meta, ...m },
});

const view = (o: Partial<PrBriefView> = {}): PrBriefView => ({
  brief: null,
  stale: false,
  current_head_sha: HEAD,
  generating: false,
  last_failure: null,
  key_available: true,
  feature_model: { provider: "openai", model: "gpt-4.1" },
  ...o,
});

// ---- fetch ----------------------------------------------------------------

const fetchMock = vi.fn();
const respond = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    statusText: status < 400 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  } as Response);
const apiError = (status: number, code: string, message: string) => respond({ error: { code, message } }, status);
const method = (c: unknown[]) => (c[1] as RequestInit | undefined)?.method ?? "GET";
const posts = () => fetchMock.mock.calls.filter((c) => method(c) === "POST");

// The verdict banner's reads (reviews, runs, active runs); empty by default.
let reviews: () => Promise<Response>;
let active: () => Promise<Response>;
let runs: () => Promise<Response>;

/** GET `/brief` answers `get()`, the banner's GETs answer their fixtures, POST answers `post()`. */
function serve(get: () => Promise<Response>, post: () => Promise<Response> = () => respond({ generating: true }, 202)) {
  fetchMock.mockImplementation((u: string, init?: RequestInit) => {
    if (init?.method === "POST") return post();
    const url = String(u);
    if (url.endsWith("/reviews")) return reviews();
    if (url.endsWith("/runs/active")) return active();
    if (url.endsWith("/runs")) return runs();
    return get();
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  reviews = () => respond([]);
  active = () => respond([]);
  runs = () => respond([]);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---- render ---------------------------------------------------------------

let qc: QueryClient;

function renderCard(messages: AbstractIntlMessages = { brief, prReview, shell, common }) {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" timeZone="UTC" now={NOW} messages={messages}>
        <PrBriefCard prId="pr-1" headSha={HEAD} lastReviewedSha={null} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const card = () => screen.getByRole("region", { name: /PR Brief/ });

/** Wait for a stored brief to be on screen (its summary is the final-state element). */
const briefShown = () => screen.findByText(BRIEF.summary);

// ---- tests ----------------------------------------------------------------

describe("PrBriefCard — states", () => {
  it("R-04 — shows a loading skeleton while the stored brief is read", () => {
    serve(() => new Promise<Response>(() => {}));
    renderCard();
    expect(within(card()).getByRole("status", { name: "Loading brief…" })).toBeInTheDocument();
    expect(screen.queryByText("No brief yet")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "PR Brief" })).toBeInTheDocument();
  });

  it("R-02, R-47, R-74 — no brief: 'No brief yet' + Generate; nothing is posted until the click, then one POST", async () => {
    let generating = false;
    serve(() => respond(view({ generating })), () => {
      generating = true;
      return respond({ generating: true }, 202);
    });
    renderCard();
    expect(await screen.findByText("No brief yet")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Generate brief" });
    expect(button).toBeEnabled();
    expect(posts()).toHaveLength(0);

    fireEvent.click(button);
    // R-05 follows: the control turns into the disabled "Generating…".
    await waitFor(() => expect(screen.getByRole("button", { name: "Generating…" })).toBeDisabled());
    expect(posts()).toHaveLength(1);
    expect(String(posts()[0]![0])).toMatch(/\/pulls\/pr-1\/brief\/generate$/);
  });

  it("R-05, R-93, F-16 — generating: Summary skeleton in the block, no Review focus here, control disabled 'Generating…', no Risk-areas skeleton here", async () => {
    serve(() => respond(view({ generating: true, brief: BRIEF })));
    renderCard();
    const skeleton = await within(card()).findByRole("status", { name: "Generating…" });
    expect(within(skeleton).getByText("Summary")).toBeInTheDocument();
    expect(within(card()).queryByText("Review focus — read these first")).not.toBeInTheDocument();
    // F-16: the Risk-areas skeleton lives in the Intent card slot, not in this block.
    expect(within(card()).queryByText("Risk areas")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generating…" })).toBeDisabled();
    // the stored brief is not shown while a generation runs
    expect(screen.queryByText(BRIEF.summary)).not.toBeInTheDocument();
  });

  it("R-06 — a failed read shows the error with its reason and Retry; Retry reads again and shows the brief", async () => {
    let fail = true;
    serve(() => (fail ? apiError(500, "internal", "Database unavailable") : respond(view({ brief: BRIEF }))));
    renderCard();
    const alert = await screen.findByRole("alert", {}, { timeout: 4000 });
    expect(alert).toHaveTextContent("Could not load the brief.");
    expect(alert).toHaveTextContent("Database unavailable");

    fail = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await briefShown()).toBeInTheDocument();
    expect(screen.queryByText("Could not load the brief.")).not.toBeInTheDocument();
  });

  it("F-10 — a read that fails over cached 'generating' data shows error + Retry, not an endless skeleton", async () => {
    serve(() => apiError(500, "internal", "API restarted"));
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(["pr-brief", "pr-1"], view({ generating: true }));
    render(
      <QueryClientProvider client={qc}>
        <NextIntlClientProvider locale="en" timeZone="UTC" now={NOW} messages={{ brief, prReview, shell, common }}>
          <PrBriefCard prId="pr-1" headSha={HEAD} lastReviewedSha={null} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
    const alert = await screen.findByRole("alert", {}, { timeout: 4000 });
    expect(alert).toHaveTextContent("Could not load the brief.");
    expect(alert).toHaveTextContent("API restarted");
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Generating…" })).not.toBeInTheDocument();
  });
});

describe("PrBriefCard — a stored brief", () => {
  it("R-08, R-48, R-71 — header line with cost and tokens, and the summary", async () => {
    serve(() => respond(view({ brief: BRIEF })));
    renderCard();
    expect(await briefShown()).toBeInTheDocument();

    // R-08: relative time from an explicit now, short (7-char) SHA, provider/model.
    expect(screen.getByText("Generated 2 hours ago for abc1234 · openai/gpt-4.1 · $0.014 · 3.1K→0.4K")).toBeInTheDocument();

    // nothing trimmed, nothing missing, not stale
    expect(screen.queryByText("Built from trimmed inputs")).not.toBeInTheDocument();
    expect(screen.queryByText(/Generated without:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Brief is for an older commit/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate brief" })).toBeEnabled();
  });

  it("R-71 — 'cost unknown' when the provider reported no cost", async () => {
    serve(() => respond(view({ brief: withMeta({ cost_usd: null }) })));
    renderCard();
    await briefShown();
    expect(screen.getByText("Generated 2 hours ago for abc1234 · openai/gpt-4.1 · cost unknown · 3.1K→0.4K")).toBeInTheDocument();
  });

  it("R-08 — a brief generated after the page's `now` reads 'now', never 'in N seconds'", async () => {
    // The provider's now is fixed at page render; the generation finishes 40 s later.
    serve(() => respond(view({ brief: withMeta({ generated_at: "2026-11-01T12:00:40.000Z" }) })));
    renderCard();
    await briefShown();
    expect(screen.getByText("Generated now for abc1234 · openai/gpt-4.1 · $0.014 · 3.1K→0.4K")).toBeInTheDocument();
    expect(screen.queryByText(/Generated in /)).not.toBeInTheDocument();
  });

  it("R-25, D-25 — 'Built from trimmed inputs' with one tooltip line per non-zero trim field", async () => {
    serve(() =>
      respond(
        view({
          brief: withMeta({
            trim: {
              specs_removed: ["specs/b.md", "specs/a.md"],
              description: "truncated",
              callers_removed: 3,
              issue_body: "dropped",
              diff_rows_removed: 2,
              focus_lines_moved: 1,
              input_tokens: 8000,
            },
          }),
        }),
      ),
    );
    renderCard();
    await briefShown();
    const note = screen.getByText("Built from trimmed inputs");
    expect(note).toHaveAttribute("tabindex", "0");
    const tip = within(note).getByRole("tooltip");
    for (const text of [
      "Specs removed: specs/b.md, specs/a.md",
      "PR description truncated",
      "3 blast-radius callers removed",
      "Linked issue body removed",
      "2 changed-file rows removed",
      "1 Review focus lines moved to the nearest changed line",
    ]) {
      expect(within(tip).getByText(text)).toBeInTheDocument();
    }
  });

  it("R-25, AP-8 — a moved focus line alone counts as trimmed; input_tokens alone does not", async () => {
    const trim = { ...BRIEF.meta.trim, focus_lines_moved: 2, input_tokens: 7999 };
    serve(() => respond(view({ brief: withMeta({ trim }) })));
    renderCard();
    await briefShown();
    const tip = within(screen.getByText("Built from trimmed inputs")).getByRole("tooltip");
    expect(tip).toHaveTextContent("2 Review focus lines moved to the nearest changed line");
    expect(within(tip).queryByText(/removed|truncated/)).not.toBeInTheDocument();
  });

  it("R-28, D-17 — 'Generated without:' lists every missing input with a readable reason, in the server's order", async () => {
    serve(() =>
      respond(
        view({
          brief: withMeta({
            missing_inputs: [
              { input: "intent", reason: "not_derived" },
              { input: "blast", reason: "degraded:stale_index" },
              { input: "description", reason: "empty" },
              { input: "issue", reason: "github_unavailable" },
              { input: "specs", reason: "not_cloned" },
            ],
          }),
        }),
      ),
    );
    renderCard();
    await briefShown();
    expect(
      screen.getByText(
        "Generated without: intent (not derived), blast radius (index degraded (stale_index)), PR description (empty), linked issue (GitHub not connected), specs (repository not cloned)",
      ),
    ).toBeInTheDocument();
  });

  it("R-46 — a stale brief shows the older-commit badge with the brief's short SHA, and Regenerate stays enabled", async () => {
    serve(() => respond(view({ brief: BRIEF, stale: true, current_head_sha: "fff9999aaaa" })));
    renderCard();
    await briefShown();
    expect(screen.getByText("Brief is for an older commit (abc1234)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate brief" })).toBeEnabled();
    expect(posts()).toHaveLength(0); // R-47: stale never regenerates on its own
  });

  it("R-36, D-28 — model text with HTML and markdown renders as literal text: no img, no link, no script run", async () => {
    const summary = 'Ships <img src=x onerror="window.__pwned=1"> and [x](http://e) **bold**';
    serve(() =>
      respond(
        view({
          brief: {
            ...BRIEF,
            summary,
          },
        }),
      ),
    );
    renderCard();
    expect(await screen.findByText(summary)).toBeInTheDocument();
    expect(card().querySelector("img")).toBeNull();
    expect(within(card()).queryAllByRole("link")).toHaveLength(0);
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });
});

describe("PrBriefCard — keys and failures", () => {
  it("R-68 — no key: the provider is named with a Settings link before any click; Generate is disabled", async () => {
    serve(() => respond(view({ key_available: false, feature_model: { provider: "anthropic", model: "claude-x" } })));
    renderCard();
    expect(await screen.findByText("No brief yet")).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("No API key for anthropic");
    expect(within(status).getByRole("link", { name: "Settings → API Keys" })).toHaveAttribute("href", "/settings/api-keys");
    const button = screen.getByRole("button", { name: "Generate brief" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(posts()).toHaveLength(0);
  });

  it("R-68 — no key with a stored brief: Regenerate is disabled too", async () => {
    serve(() => respond(view({ brief: BRIEF, stale: true, key_available: false })));
    renderCard();
    await briefShown();
    expect(screen.getByText("No API key for openai")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate brief" })).toBeDisabled();
  });

  it("R-39, F-13 — a 409 no-key start shows the server's message with the Settings link, until the view changes", async () => {
    const message = "No API key for openai — add one in Settings → API Keys or pick another model for Risk Brief";
    serve(
      () => respond(view()),
      () => apiError(409, "brief_no_api_key", message),
    );
    renderCard();
    // the button exists (disabled) while loading — wait for the settled view first
    await screen.findByText("No brief yet");
    fireEvent.click(screen.getByRole("button", { name: "Generate brief" }));
    const box = await screen.findByRole("alert");
    expect(box).toHaveTextContent(message);
    expect(within(box).getByRole("link", { name: "Settings → API Keys" })).toHaveAttribute("href", "/settings/api-keys");
    // the refetch that follows the rejection does not hide it
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter((c) => method(c) === "GET" && String(c[0]).endsWith("/brief")).length).toBeGreaterThan(1),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(message);

    // F-13: once the view changes (a brief arrives), the rejection is stale and goes away.
    qc.setQueryData(["pr-brief", "pr-1"], view({ brief: BRIEF }));
    expect(await briefShown()).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(card()).not.toHaveTextContent(message);
  });

  it("R-15 — a 409 'already running' start shows the server's message without the Settings link", async () => {
    const message = "A brief is already being generated for this PR";
    serve(
      () => respond(view()),
      () => apiError(409, "brief_generation_running", message),
    );
    renderCard();
    // the button exists (disabled) while loading — wait for the settled view first
    await screen.findByText("No brief yet");
    fireEvent.click(screen.getByRole("button", { name: "Generate brief" }));
    const text = await screen.findByText(message);
    expect(within(text.closest("[role=alert]") as HTMLElement).queryByRole("link")).not.toBeInTheDocument();
  });

  it("R-61 — a failure over a stored brief: the brief stays, a dismissible notice sits above it; a newer failure shows again", async () => {
    const first = { code: "timeout" as const, message: "timed out", at: "2026-11-01T11:00:00.000Z" };
    serve(() => respond(view({ brief: BRIEF, last_failure: first })));
    renderCard();
    await briefShown();
    const notice = screen.getByText("Regeneration failed — timed out");
    // above the summary in document order
    expect(notice.compareDocumentPosition(screen.getByText(BRIEF.summary)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Regeneration failed — timed out")).not.toBeInTheDocument();
    expect(screen.getByText(BRIEF.summary)).toBeInTheDocument();

    qc.setQueryData(
      ["pr-brief", "pr-1"],
      view({ brief: BRIEF, last_failure: { code: "invalid_output", message: "The model returned invalid output", at: "2026-11-01T11:30:00.000Z" } }),
    );
    expect(await screen.findByText("Regeneration failed — The model returned invalid output")).toBeInTheDocument();
  });

  it("R-62 — a failure with no stored brief: 'Generation failed — <reason>' and Generate enabled again", async () => {
    serve(() =>
      respond(view({ last_failure: { code: "provider_error", message: "429 rate limited", at: "2026-11-01T11:00:00.000Z" } })),
    );
    renderCard();
    expect(await screen.findByText("Generation failed — 429 rate limited")).toBeInTheDocument();
    expect(screen.getByText("No brief yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate brief" })).toBeEnabled();
  });
});

// ---- R-07: every label comes from brief.json --------------------------------

/** Wrap every message string in « » — a component string that is not wrapped was not translated. */
function mark<T>(v: T): T {
  if (typeof v === "string") return `«${v}»` as unknown as T;
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, mark(x)])) as T;
  }
  return v;
}

/** Text nodes inside `root` that are neither translated, model data, nor bare punctuation/digits. */
function untranslated(root: HTMLElement, data: string[]): string[] {
  const out: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = (n.textContent ?? "").trim();
    if (!text || text.includes("«") || /^[\d\s—·:.,\-()]+$/.test(text) || data.includes(text)) continue;
    out.push(text);
  }
  return out;
}

describe("PrBriefCard — R-07, no hardcoded strings", () => {
  const marked = { brief: mark(brief), shell: mark(shell), common: mark(common) };
  const modelData = [
    BRIEF.summary,
    ...BRIEF.review_focus.map((f) => f.reason),
    ...BRIEF.review_focus.map((f) => `${f.file}:${f.line}`),
  ];

  it("every visible string of the full brief state is a brief.json message", async () => {
    serve(() =>
      respond(
        view({
          brief: withMeta({
            missing_inputs: [{ input: "issue", reason: "fetch_failed" }],
            trim: { ...BRIEF.meta.trim, callers_removed: 4, description: "dropped" },
          }),
          stale: true,
          key_available: false,
          last_failure: { code: "timeout", message: "timed out", at: "2026-11-01T11:00:00.000Z" },
        }),
      ),
    );
    renderCard(marked);
    await screen.findByText(BRIEF.summary);
    expect(untranslated(card(), [...modelData, "timed out"])).toEqual([]);
  });

  it("every visible string of the empty, failed and generating states is a brief.json message", async () => {
    let generating = false;
    serve(() =>
      respond(
        view({
          generating,
          last_failure: generating ? null : { code: "timeout", message: "timed out", at: "2026-11-01T11:00:00.000Z" },
        }),
      ),
    );
    renderCard(marked);
    await screen.findByText(/No brief yet/);
    expect(untranslated(card(), ["timed out"])).toEqual([]);

    generating = true;
    await qc.refetchQueries({ queryKey: ["pr-brief", "pr-1"] });
    await screen.findByRole("status", { name: "«Generating…»" });
    expect(untranslated(card(), [])).toEqual([]);
  });
});
