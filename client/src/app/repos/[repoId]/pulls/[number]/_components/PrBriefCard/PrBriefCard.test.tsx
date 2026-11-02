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
import type { FindingRecord, PrBrief, PrBriefView, ReviewRecord, RunSummary } from "@devdigest/shared";
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

function renderCard(messages: AbstractIntlMessages = { brief, prReview, shell, common }, lastReviewedSha: string | null = null) {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" timeZone="UTC" now={NOW} messages={messages}>
        <PrBriefCard prId="pr-1" headSha={HEAD} lastReviewedSha={lastReviewedSha} />
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

// ---- verdict banner (R-78 … R-105, plan step 16) ----------------------------

const finding = (id: string, severity: FindingRecord["severity"], dismissed_at: string | null = null): FindingRecord => ({
  id,
  severity,
  category: "security",
  title: `Finding ${id}`,
  file: "src/api/public/webhooks.ts",
  start_line: 1,
  end_line: 2,
  rationale: "r",
  confidence: 0.9,
  review_id: "rev-new",
  accepted_at: null,
  dismissed_at,
});

/** The latest review: 3 findings (1 CRITICAL, 1 CRITICAL dismissed, 1 WARNING) → "3 findings · 1 blockers". */
const REVIEW: ReviewRecord = {
  id: "rev-new",
  pr_id: "pr-1",
  agent_id: "agent-sec",
  run_id: "run-new",
  agent_name: "Security Reviewer",
  kind: "review",
  verdict: "request_changes",
  summary: "Review text.",
  score: 61,
  model: "gpt-4.1",
  created_at: "2026-11-01T11:00:00.000Z",
  findings: [finding("f1", "CRITICAL"), finding("f2", "CRITICAL", "2026-11-01T11:10:00.000Z"), finding("f3", "WARNING")],
};
/** Newer than REVIEW, but of kind "summary": never the latest review (R-82). */
const SUMMARY_ROW: ReviewRecord = {
  ...REVIEW,
  id: "rev-summary",
  agent_name: "Summarizer",
  kind: "summary",
  verdict: "approve",
  summary: "Summary row text.",
  score: 95,
  created_at: "2026-11-01T11:30:00.000Z",
  findings: [],
};
/** Older review: must lose to REVIEW (R-82). */
const OLD_REVIEW: ReviewRecord = {
  ...REVIEW,
  id: "rev-old",
  agent_name: "Old Agent",
  verdict: "approve",
  summary: "Old review text.",
  score: 90,
  created_at: "2026-10-30T09:00:00.000Z",
  findings: [],
};
const ALL_REVIEWS = [SUMMARY_ROW, OLD_REVIEW, REVIEW];

const run = (o: Partial<RunSummary>): RunSummary => ({
  run_id: "run-x",
  agent_id: "agent-sec",
  agent_name: "Security Reviewer",
  provider: "openai",
  model: "gpt-4.1",
  status: "done",
  error: null,
  duration_ms: 1000,
  tokens_in: 10,
  tokens_out: 10,
  cost_usd: 0.01,
  findings_count: 3,
  grounding: null,
  ran_at: "2026-11-01T11:00:00.000Z",
  score: 61,
  blockers: 1,
  ...o,
});
const ACTIVE = [{ run_id: "run-live", agent_id: "agent-sec", agent_name: "Security Reviewer", ran_at: "2026-11-01T11:59:00.000Z" }];

const NO_REVIEW_LINE = "No review yet — run one to see the verdict and PR score";
const RUNNING_NOTE = "Review in progress — showing the previous review";
const FAILED_NOTE = "The latest review run failed — showing the previous review";
const bannerShown = () => screen.findByRole("group", { name: "Latest review" });
/** Wait until the reviews read has settled (success or error), so an absent banner is a final state. */
const reviewsSettled = () =>
  waitFor(() => expect(["success", "error"]).toContain(qc.getQueryState(["reviews", "pr-1"])?.status));
const follows = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("PrBriefCard — verdict banner", () => {
  it("R-78, BA-1 — with a brief: the banner sits under the header and run line, above the rest of the block", async () => {
    reviews = () => respond(ALL_REVIEWS);
    const failure = { code: "timeout" as const, message: "timed out", at: "2026-11-01T11:00:00.000Z" };
    serve(() => respond(view({ brief: BRIEF, last_failure: failure })));
    renderCard();
    const group = await bannerShown();
    await screen.findByText("Regeneration failed — timed out");
    expect(card().contains(group)).toBe(true);
    expect(within(group).getByText("Request changes")).toBeInTheDocument();
    expect(follows(screen.getByRole("heading", { name: "PR Brief" }), group)).toBe(true);
    expect(follows(screen.getByText(/^Generated 2 hours ago for abc1234/), group)).toBe(true);
    // the rest of the block (here the regeneration notice) comes after it
    expect(follows(group, screen.getByText("Regeneration failed — timed out"))).toBe(true);
  });

  it("R-78 — without a brief: the banner still shows, above 'No brief yet'", async () => {
    reviews = () => respond([REVIEW]);
    serve(() => respond(view()));
    renderCard();
    const group = await bannerShown();
    const empty = await screen.findByText("No brief yet");
    expect(follows(group, empty)).toBe(true);
  });

  it("R-79, R-83, R-80, R-105 — counts as Agent runs counts them, the score ring and the agent badge", async () => {
    reviews = () => respond([REVIEW]);
    serve(() => respond(view()));
    renderCard();
    const group = await bannerShown();
    // every finding (3); blockers = CRITICAL and not dismissed (1)
    expect(within(group).getByText("3 findings · 1 blockers")).toBeInTheDocument();
    expect(within(group).getByText("61")).toBeInTheDocument();
    expect(within(group).getByText("PR SCORE")).toBeInTheDocument();
    expect(within(group).getByText("Security Reviewer")).toBeInTheDocument();
  });

  it("R-79 — no blockers: only the findings count, no blockers part", async () => {
    reviews = () =>
      respond([{ ...REVIEW, findings: [finding("f3", "WARNING"), finding("f2", "CRITICAL", "2026-11-01T11:10:00.000Z")] }]);
    serve(() => respond(view()));
    renderCard();
    const group = await bannerShown();
    expect(within(group).getByText("2 findings")).toBeInTheDocument();
    expect(within(group).queryByText(/blockers/)).not.toBeInTheDocument();
  });

  it("R-86 — no score: no ring, no 'PR SCORE', no placeholder number", async () => {
    reviews = () => respond([{ ...REVIEW, score: null }]);
    serve(() => respond(view()));
    renderCard();
    const group = await bannerShown();
    expect(within(group).getByText("Request changes")).toBeInTheDocument();
    expect(within(group).queryByText("PR SCORE")).not.toBeInTheDocument();
    expect(within(group).queryByText(/^\s*\d+\s*$/)).not.toBeInTheDocument();
  });

  it("R-81, R-48 — with a brief, its summary is the banner's text, shown exactly once; the review's own is not", async () => {
    reviews = () => respond([REVIEW]);
    serve(() => respond(view({ brief: BRIEF })));
    renderCard();
    const group = await bannerShown();
    expect(await within(group).findByText(BRIEF.summary)).toBeInTheDocument();
    expect(screen.getAllByText(BRIEF.summary)).toHaveLength(1);
    expect(screen.queryByText("Review text.")).not.toBeInTheDocument();
  });

  it("R-96 — no brief: the review's own summary is the banner's text; also when the brief read failed", async () => {
    reviews = () => respond([REVIEW]);
    serve(() => respond(view()));
    renderCard();
    const group = await bannerShown();
    await screen.findByText("No brief yet");
    expect(within(group).getByText("Review text.")).toBeInTheDocument();
    cleanup();

    serve(() => apiError(500, "internal", "Database unavailable"));
    renderCard();
    await screen.findByRole("alert", {}, { timeout: 4000 });
    expect(within(await bannerShown()).getByText("Review text.")).toBeInTheDocument();
  });

  it("R-96 — an empty review summary shows no text, and never another review's", async () => {
    reviews = () => respond([OLD_REVIEW, { ...REVIEW, summary: "" }]);
    serve(() => respond(view()));
    renderCard();
    const group = await bannerShown();
    await screen.findByText("No brief yet");
    expect(within(group).getByText("Request changes")).toBeInTheDocument();
    expect(group).not.toHaveTextContent("Old review text.");
    expect(within(group).queryByRole("status")).not.toBeInTheDocument();
  });

  it("R-97, R-05, B-03 — generating: verdict and counts stay, the one 'Generating…' status is the banner's text", async () => {
    reviews = () => respond([REVIEW]);
    serve(() => respond(view({ generating: true, brief: BRIEF })));
    renderCard();
    const group = await bannerShown();
    expect(await within(group).findByRole("status", { name: "Generating…" })).toBeInTheDocument();
    expect(screen.getAllByRole("status", { name: "Generating…" })).toHaveLength(1);
    expect(within(group).getByText("Request changes")).toBeInTheDocument();
    expect(within(group).getByText("3 findings · 1 blockers")).toBeInTheDocument();
    expect(within(group).getByText("61")).toBeInTheDocument();
    expect(screen.queryByText(BRIEF.summary)).not.toBeInTheDocument();
    expect(screen.queryByText("Review text.")).not.toBeInTheDocument();
    // the block's own Summary skeleton is not stacked under the banner's
    expect(within(card()).queryByText("Summary")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generating…" })).toBeDisabled();
  });

  it("R-04, BA-2, B-04 — reading the brief with a review: the banner's text holds the single 'Loading brief…' status", async () => {
    reviews = () => respond([REVIEW]);
    serve(() => new Promise<Response>(() => {}));
    renderCard();
    const group = await bannerShown();
    expect(within(group).getByRole("status", { name: "Loading brief…" })).toBeInTheDocument();
    expect(screen.getAllByRole("status", { name: "Loading brief…" })).toHaveLength(1);
    // no flash of the review's own summary while the brief is read
    expect(screen.queryByText("Review text.")).not.toBeInTheDocument();
  });

  it("R-82 — the newest review of kind 'review' wins over a newer 'summary' row and an older review", async () => {
    reviews = () => respond(ALL_REVIEWS);
    serve(() => respond(view()));
    renderCard();
    const group = await bannerShown();
    expect(within(group).getByText("Request changes")).toBeInTheDocument();
    expect(within(group).getByText("Review text.")).toBeInTheDocument();
    expect(within(group).getByText("Security Reviewer")).toBeInTheDocument();
    expect(within(group).queryByText("Approve")).not.toBeInTheDocument();
    expect(group).not.toHaveTextContent("Summary row text.");
    expect(group).not.toHaveTextContent("Old review text.");
    expect(within(group).queryByText("95")).not.toBeInTheDocument();
  });

  it("R-84, R-101 — no review: one muted line with no link or button, no banner, and the brief's summary as usual", async () => {
    serve(() => respond(view({ brief: BRIEF })));
    renderCard();
    await briefShown();
    await reviewsSettled();
    const line = await screen.findByText(NO_REVIEW_LINE);
    expect(card().contains(line)).toBe(true);
    expect(within(line).queryByRole("link")).not.toBeInTheDocument();
    expect(within(line).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Latest review" })).not.toBeInTheDocument();
    expect(screen.queryByText("PR SCORE")).not.toBeInTheDocument();
    expect(screen.queryByText(/findings/)).not.toBeInTheDocument();
    expect(follows(line, screen.getByText(BRIEF.summary))).toBe(true);
  });

  it("R-99 — the reviews read fails: no banner, no line, no notes; the brief still shows", async () => {
    reviews = () => apiError(500, "internal", "reviews down");
    active = () => respond(ACTIVE);
    runs = () => respond([run({ status: "failed", ran_at: "2026-11-01T11:50:00.000Z" })]);
    serve(() => respond(view({ brief: BRIEF })));
    renderCard();
    await briefShown();
    await waitFor(() => expect(qc.getQueryState(["reviews", "pr-1"])?.status).toBe("error"));
    await waitFor(() => expect(qc.getQueryState(["pr-active-runs", "pr-1"])?.status).toBe("success"));
    await waitFor(() => expect(qc.getQueryState(["pr-runs", "pr-1"])?.status).toBe("success"));
    expect(screen.queryByRole("group", { name: "Latest review" })).not.toBeInTheDocument();
    for (const text of [NO_REVIEW_LINE, "Review in progress", RUNNING_NOTE, FAILED_NOTE]) {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Regenerate brief" })).toBeEnabled();
  });

  it("R-102, R-87 — a run in progress with a review: the note, and the stored review stays shown", async () => {
    reviews = () => respond([REVIEW]);
    active = () => respond(ACTIVE);
    serve(() => respond(view()));
    renderCard();
    const group = await bannerShown();
    expect(await within(group).findByText(RUNNING_NOTE)).toBeInTheDocument();
    expect(within(group).getByText("Request changes")).toBeInTheDocument();
    expect(within(group).getByText("3 findings · 1 blockers")).toBeInTheDocument();
    expect(within(group).getByText("Review text.")).toBeInTheDocument();
    expect(screen.queryByText(FAILED_NOTE)).not.toBeInTheDocument();
  });

  it("R-103 — a run in progress with no review: 'Review in progress' replaces the R-101 line", async () => {
    active = () => respond(ACTIVE);
    serve(() => respond(view()));
    renderCard();
    expect(await screen.findByText("Review in progress")).toBeInTheDocument();
    expect(screen.queryByText(NO_REVIEW_LINE)).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Latest review" })).not.toBeInTheDocument();
  });

  it.each(["failed", "cancelled"])("R-104, R-89 — newest run %s: the failed note, and the stored review stays", async (status) => {
    reviews = () => respond([REVIEW]);
    runs = () =>
      respond([
        run({ run_id: "run-new", status: "done", ran_at: "2026-11-01T11:00:00.000Z" }),
        run({ run_id: "run-bad", status, ran_at: "2026-11-01T11:40:00.000Z", score: null, blockers: null }),
      ]);
    serve(() => respond(view()));
    renderCard();
    const group = await bannerShown();
    expect(await within(group).findByText(FAILED_NOTE)).toBeInTheDocument();
    expect(within(group).getByText("Request changes")).toBeInTheDocument();
    expect(within(group).getByText("Review text.")).toBeInTheDocument();
    expect(screen.queryByText(RUNNING_NOTE)).not.toBeInTheDocument();
  });

  it("R-104 — a failed run older than the newest run gets no note", async () => {
    reviews = () => respond([REVIEW]);
    runs = () =>
      respond([
        run({ run_id: "run-bad", status: "failed", ran_at: "2026-11-01T10:00:00.000Z" }),
        run({ run_id: "run-new", status: "done", ran_at: "2026-11-01T11:00:00.000Z" }),
      ]);
    serve(() => respond(view()));
    renderCard();
    await bannerShown();
    await waitFor(() => expect(qc.getQueryState(["pr-runs", "pr-1"])?.status).toBe("success"));
    expect(screen.queryByText(FAILED_NOTE)).not.toBeInTheDocument();
  });

  it("R-104, R-102 — a newer run has started: the in-progress note replaces the failed one", async () => {
    reviews = () => respond([REVIEW]);
    active = () => respond(ACTIVE);
    runs = () => respond([run({ run_id: "run-bad", status: "failed", ran_at: "2026-11-01T11:40:00.000Z" })]);
    serve(() => respond(view()));
    renderCard();
    const group = await bannerShown();
    expect(await within(group).findByText(RUNNING_NOTE)).toBeInTheDocument();
    await waitFor(() => expect(qc.getQueryState(["pr-runs", "pr-1"])?.status).toBe("success"));
    expect(screen.queryByText(FAILED_NOTE)).not.toBeInTheDocument();
  });

  it("R-94 — a review of another commit gets the older-commit badge; verdict, counts and score stay", async () => {
    reviews = () => respond([REVIEW]);
    serve(() => respond(view()));
    renderCard(undefined, "rev1234aaaa");
    const group = await bannerShown();
    expect(within(group).getByText("Review is for an older commit (rev1234)")).toBeInTheDocument();
    expect(within(group).getByText("Request changes")).toBeInTheDocument();
    expect(within(group).getByText("3 findings · 1 blockers")).toBeInTheDocument();
    expect(within(group).getByText("61")).toBeInTheDocument();
  });

  it.each([
    ["equal to the head", HEAD],
    ["null", null],
  ])("R-94 — no older-commit badge when the last-reviewed SHA is %s", async (_label, sha) => {
    reviews = () => respond([REVIEW]);
    serve(() => respond(view()));
    renderCard(undefined, sha);
    const group = await bannerShown();
    expect(within(group).getByText("Request changes")).toBeInTheDocument();
    expect(screen.queryByText(/Review is for an older commit/)).not.toBeInTheDocument();
  });

  it("R-98 — the banner shows no cost and no tokens (the run line keeps them, outside the banner)", async () => {
    reviews = () => respond([REVIEW]);
    serve(() => respond(view({ brief: BRIEF })));
    renderCard();
    const group = await bannerShown();
    await within(group).findByText(BRIEF.summary);
    expect(group).not.toHaveTextContent("$");
    expect(group).not.toHaveTextContent("→");
    expect(group).not.toHaveTextContent(/tokens|cost/i);
    const runLine = screen.getByText("Generated 2 hours ago for abc1234 · openai/gpt-4.1 · $0.014 · 3.1K→0.4K");
    expect(group.contains(runLine)).toBe(false);
  });

  it("R-88, B-02 — a run that ends while the tab is open shows its review without a remount, and re-reads runs and the PR", async () => {
    let activeRuns: unknown[] = ACTIVE;
    let stored: ReviewRecord[] = [];
    active = () => respond(activeRuns);
    reviews = () => respond(stored);
    serve(() => respond(view()));
    renderCard();
    expect(await screen.findByText("Review in progress")).toBeInTheDocument();
    // the PR read (carrier of last_reviewed_sha, R-95) is cached and fresh
    qc.setQueryData(["pull", "pr-1"], { id: "pr-1", last_reviewed_sha: null });
    expect(qc.getQueryState(["pull", "pr-1"])?.isInvalidated).toBe(false);
    const runReads = () => fetchMock.mock.calls.filter((c) => String(c[0]).endsWith("/runs")).length;
    await waitFor(() => expect(runReads()).toBeGreaterThan(0));
    const runReadsBefore = runReads();

    activeRuns = [];
    stored = [REVIEW];
    await qc.refetchQueries({ queryKey: ["pr-active-runs", "pr-1"] });

    const group = await bannerShown();
    expect(within(group).getByText("Request changes")).toBeInTheDocument();
    expect(within(group).getByText("Review text.")).toBeInTheDocument();
    expect(screen.queryByText("Review in progress")).not.toBeInTheDocument();
    // the run history is re-read, and the PR read is marked stale (B-02)
    await waitFor(() => expect(runReads()).toBeGreaterThan(runReadsBefore));
    expect(qc.getQueryState(["pull", "pr-1"])?.isInvalidated).toBe(true);
  });

  it("R-85 — the banner reads only stored data: /brief, /reviews, /runs, /runs/active, and no POST", async () => {
    reviews = () => respond([REVIEW]);
    active = () => respond(ACTIVE);
    runs = () => respond([run({})]);
    serve(() => respond(view({ brief: BRIEF })));
    renderCard();
    await within(await bannerShown()).findByText(RUNNING_NOTE);
    await waitFor(() => expect(qc.getQueryState(["pr-runs", "pr-1"])?.status).toBe("success"));
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(u).toMatch(/\/pulls\/pr-1\/(brief|reviews|runs|runs\/active)$/);
    for (const path of ["/brief", "/reviews", "/runs", "/runs/active"]) {
      expect(urls.some((u) => u.endsWith(path))).toBe(true);
    }
    expect(posts()).toHaveLength(0);
  });

  it("R-07 — every visible string of the banner and its notes is a translated message (brief or prReview)", async () => {
    reviews = () => respond([REVIEW]);
    active = () => respond(ACTIVE);
    serve(() => respond(view({ brief: BRIEF })));
    renderCard({ brief: mark(brief), prReview: mark(prReview), shell: mark(shell), common: mark(common) }, "rev1234aaaa");
    // the group's accessible name is a brief.json message too
    const group = await screen.findByRole("group", { name: "«Latest review»" });
    await within(group).findByText(/Review in progress/);
    await within(group).findByText(/Review is for an older commit/);
    await within(group).findByText(BRIEF.summary);
    expect(within(group).getByText(/Request changes/)).toHaveTextContent("«Request changes»");
    expect(untranslated(card(), [BRIEF.summary, REVIEW.agent_name!])).toEqual([]);
  });

  it("R-07 — the no-review line is a brief.json message", async () => {
    serve(() => respond(view({ brief: BRIEF })));
    renderCard({ brief: mark(brief), prReview: mark(prReview), shell: mark(shell), common: mark(common) });
    await screen.findByText(`«${NO_REVIEW_LINE}»`);
    expect(untranslated(card(), [BRIEF.summary])).toEqual([]);
  });
});
