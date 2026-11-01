/**
 * OverviewTab — plan step 25e: the PR Brief block above the cards (R-01); the
 * brief's Risk areas in the Intent card (R-63) or the intent's own list
 * (R-67), with the generating skeleton in that slot (F-16); navigation from a
 * reference (R-53, R-55); "File not in this PR's diff" for 4 s or until the
 * next activation (R-56, D-30); scroll saved before the navigation and
 * restored only on Back (R-77, D-32, F-14).
 *
 * The real cards and hooks run over a mocked `fetch`; the Blast radius read
 * fails on purpose (that card is not under test here).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, cleanup, fireEvent, waitFor, within, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PrBrief, PrBriefView, PrIntentRecord } from "@devdigest/shared";
import brief from "../../../../../../../../messages/en/brief.json";
import shell from "../../../../../../../../messages/en/shell.json";
import common from "../../../../../../../../messages/en/common.json";
import blast from "../../../../../../../../messages/en/blast.json";
import { OverviewTab } from "./OverviewTab";

// ---- fixtures -------------------------------------------------------------

const NOW = new Date("2026-11-01T12:00:00.000Z");
const IN_DIFF = "src/api/public/webhooks.ts";
const BLAST_ONLY = "src/billing/invoice.ts";

const BRIEF: PrBrief = {
  summary: "Adds a webhook signature check.",
  intent: null,
  blast: null,
  risks: {
    risks: [
      {
        kind: "security",
        title: "Signature check can be bypassed",
        explanation: "Non constant-time compare.",
        severity: "high",
        file_refs: [`${IN_DIFF}:61-74`, IN_DIFF],
      },
      {
        kind: "data",
        title: "Invoice totals shift",
        explanation: "Rounding.",
        severity: "low",
        file_refs: [`${BLAST_ONLY}:40`],
      },
    ],
  },
  review_focus: [
    { file: IN_DIFF, line: 61, reason: "Read the compare first." },
    { file: BLAST_ONLY, line: 7, reason: "Caller of the handler." },
  ],
  history: null,
  meta: {
    head_sha: "abc1234def",
    generated_at: "2026-11-01T10:00:00.000Z",
    provider: "openai",
    model: "gpt-4.1",
    tokens_in: 1,
    tokens_out: 1,
    cost_usd: 0.01,
    missing_inputs: [],
    trim: {
      specs_removed: [],
      description: "kept",
      callers_removed: 0,
      issue_body: "kept",
      diff_rows_removed: 0,
      focus_lines_moved: 0,
      input_tokens: 100,
    },
    dropped: { risks: 0, risk_refs: 0, review_focus: 0 },
  },
};

const INTENT: PrIntentRecord = {
  pr_id: "pr-1",
  intent: "Reject forged webhook events.",
  in_scope: ["webhook handler"],
  out_of_scope: [],
  kind: "security",
  risk_areas: ["Touches payment webhooks"],
  conflicts: [],
  confidence: "high",
  sources: [],
  generated_at: "2026-11-01T09:00:00.000Z",
  head_sha: "abc1234def",
  provider: "openai",
  model: "gpt-4.1-mini",
};

const view = (o: Partial<PrBriefView> = {}): PrBriefView => ({
  brief: BRIEF,
  stale: false,
  current_head_sha: "abc1234def",
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

let briefView: PrBriefView;
let intent: PrIntentRecord | null;

beforeEach(() => {
  briefView = view();
  intent = INTENT;
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    const u = String(url);
    if (u.endsWith("/pulls/pr-1/brief")) return respond(briefView);
    if (u.endsWith("/pulls/pr-1/intent")) {
      return intent ? respond(intent) : respond({ error: { code: "intent_not_derived", message: "not derived" } }, 404);
    }
    if (u.endsWith("/pulls/pr-1/runs/active")) return respond([]);
    return respond({ error: { code: "not_found", message: "not in this test" } }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---- render ---------------------------------------------------------------

let onOpenInDiff: ReturnType<typeof vi.fn>;

function tree(qc: QueryClient) {
  return (
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" timeZone="UTC" now={NOW} messages={{ brief, shell, common, blast }}>
        <OverviewTab
          prId="pr-1"
          prBody="PR body text"
          repoId="repo-1"
          repoFullName="acme/api"
          headSha="abc1234def"
          changedPaths={[IN_DIFF, "src/lib/other.ts"]}
          onOpenInDiff={onOpenInDiff}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

function renderTab() {
  onOpenInDiff = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(tree(qc));
}

const briefCard = () => screen.getByRole("region", { name: "PR Brief" });
const intentCard = () => screen.getByRole("region", { name: "Intent" });
/** The final state: the summary of the stored brief and the intent quote are on screen. */
async function settled() {
  await screen.findByText(BRIEF.summary);
  await within(intentCard()).findByText(/Reject forged webhook events\./);
}

// ---- tests ----------------------------------------------------------------

describe("OverviewTab — layout", () => {
  it("R-01 — the PR Brief block comes before the Intent and Blast radius cards", async () => {
    renderTab();
    await settled();
    const blastCard = screen.getByRole("region", { name: "Blast radius" });
    expect(briefCard().compareDocumentPosition(intentCard()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(briefCard().compareDocumentPosition(blastCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // and is not nested inside either card
    expect(intentCard().contains(briefCard())).toBe(false);
  });

  it("R-63 — with a brief, the Intent card shows the brief's Risk areas instead of the intent's list", async () => {
    renderTab();
    await settled();
    const card = intentCard();
    expect(within(card).getByText("Risk areas")).toBeInTheDocument();
    expect(within(card).getByText("Signature check can be bypassed")).toBeInTheDocument();
    expect(within(card).getByText("Invoice totals shift")).toBeInTheDocument();
    expect(within(card).queryByText("Touches payment webhooks")).not.toBeInTheDocument();
    // the brief block itself does not repeat them
    expect(within(briefCard()).queryByText("Signature check can be bypassed")).not.toBeInTheDocument();
  });

  it("R-67 — with no brief stored, the Intent card shows the intent's own risk-area list", async () => {
    briefView = view({ brief: null });
    renderTab();
    await screen.findByText("No brief yet");
    const card = intentCard();
    expect(await within(card).findByText("Touches payment webhooks")).toBeInTheDocument();
    expect(within(card).queryByText("Signature check can be bypassed")).not.toBeInTheDocument();
  });

  it("R-63 — with a brief but no derived intent, the brief's Risk areas still show in the Intent card", async () => {
    intent = null;
    renderTab();
    await screen.findByText(BRIEF.summary);
    const card = intentCard();
    expect(await within(card).findByText("Intent not derived yet.")).toBeInTheDocument();
    expect(within(card).getByText("Signature check can be bypassed")).toBeInTheDocument();
  });

  it("R-05, F-16 — while generating, the Risk-areas skeleton sits in the Intent card slot", async () => {
    briefView = view({ generating: true });
    renderTab();
    const card = intentCard();
    await within(card).findByText(/Reject forged webhook events\./);
    expect(within(card).getByText("Risk areas")).toBeInTheDocument();
    expect(within(card).getByRole("status", { name: "Generating…" })).toBeInTheDocument();
    expect(within(card).queryByText("Touches payment webhooks")).not.toBeInTheDocument();
    expect(within(card).queryByText("Signature check can be bypassed")).not.toBeInTheDocument();
  });
});

describe("OverviewTab — navigation", () => {
  it("R-53, R-55 — an in-diff Review focus item or risk ref opens Files changed at its file and line (or the top)", async () => {
    renderTab();
    await settled();
    fireEvent.click(within(briefCard()).getByRole("button", { name: `Open ${IN_DIFF} at line 61` }));
    expect(onOpenInDiff).toHaveBeenLastCalledWith(IN_DIFF, 61);

    // risk ref: its first line
    fireEvent.click(within(intentCard()).getByRole("button", { name: `Open ${IN_DIFF} at line 61` }));
    expect(onOpenInDiff).toHaveBeenLastCalledWith(IN_DIFF, 61);

    // a ref with no line: the top of the file
    fireEvent.click(within(intentCard()).getByRole("button", { name: "Show details for Signature check can be bypassed" }));
    fireEvent.click(within(intentCard()).getByRole("button", { name: `Open ${IN_DIFF}` }));
    expect(onOpenInDiff).toHaveBeenLastCalledWith(IN_DIFF, null);
    expect(onOpenInDiff).toHaveBeenCalledTimes(3);
    expect(screen.queryByText("File not in this PR's diff")).not.toBeInTheDocument();
  });

  it("R-56, D-30 — a blast-only item stays on Overview and shows the notice next to it for 4 s", async () => {
    renderTab();
    await settled();
    vi.useFakeTimers();
    const focusRef = within(briefCard()).getByRole("button", { name: `Open ${BLAST_ONLY} at line 7` });
    fireEvent.click(focusRef);
    expect(onOpenInDiff).not.toHaveBeenCalled();
    const row = focusRef.closest("li")!;
    expect(within(row).getByRole("status")).toHaveTextContent("File not in this PR's diff");
    expect(screen.getAllByText("File not in this PR's diff")).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(3_999);
    });
    expect(within(row).getByText("File not in this PR's diff")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText("File not in this PR's diff")).not.toBeInTheDocument();
  });

  it("R-56 — activating another item moves the notice: one at a time, and the new one gets its own full 4 s", async () => {
    renderTab();
    await settled();
    vi.useFakeTimers();
    fireEvent.click(within(briefCard()).getByRole("button", { name: `Open ${BLAST_ONLY} at line 7` }));
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    const riskRef = within(intentCard()).getByRole("button", { name: `Open ${BLAST_ONLY} at line 40` });
    fireEvent.click(riskRef);
    expect(screen.getAllByText("File not in this PR's diff")).toHaveLength(1);
    expect(within(riskRef.closest("li")!).getByText("File not in this PR's diff")).toBeInTheDocument();

    // the first timer must not clear the second notice
    act(() => {
      vi.advanceTimersByTime(3_999);
    });
    expect(screen.getAllByText("File not in this PR's diff")).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText("File not in this PR's diff")).not.toBeInTheDocument();
  });

  it("R-56 — activating an in-diff item clears a showing notice", async () => {
    renderTab();
    await settled();
    fireEvent.click(within(briefCard()).getByRole("button", { name: `Open ${BLAST_ONLY} at line 7` }));
    expect(screen.getByText("File not in this PR's diff")).toBeInTheDocument();
    fireEvent.click(within(briefCard()).getByRole("button", { name: `Open ${IN_DIFF} at line 61` }));
    expect(screen.queryByText("File not in this PR's diff")).not.toBeInTheDocument();
  });
});

describe("OverviewTab — scroll on Back (R-77, D-32, F-14)", () => {
  function setScrollY(y: number) {
    Object.defineProperty(window, "scrollY", { configurable: true, value: y });
  }

  it("restores the saved scroll position after Back, once the queries have settled", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    setScrollY(640);
    const first = renderTab();
    await settled();
    fireEvent.click(within(briefCard()).getByRole("button", { name: `Open ${IN_DIFF} at line 61` }));
    expect(onOpenInDiff).toHaveBeenCalledWith(IN_DIFF, 61);
    first.unmount(); // the page switches to Files changed
    setScrollY(0);

    window.dispatchEvent(new PopStateEvent("popstate")); // Back
    renderTab();
    await settled();
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 640));
    expect(scrollTo).toHaveBeenCalledTimes(1);

    // one-shot: a later return does not scroll again
    cleanup();
    renderTab();
    await settled();
    await new Promise((r) => setTimeout(r, 50));
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("does not restore when Overview is reached by a tab click (no Back)", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    setScrollY(900);
    const first = renderTab();
    await settled();
    fireEvent.click(within(briefCard()).getByRole("button", { name: `Open ${IN_DIFF} at line 61` }));
    first.unmount();

    renderTab(); // tab click: no popstate
    await settled();
    await new Promise((r) => setTimeout(r, 50));
    expect(scrollTo).not.toHaveBeenCalled();

    // and the saved position is forgotten, so a Back much later cannot replay it
    cleanup();
    window.dispatchEvent(new PopStateEvent("popstate"));
    renderTab();
    await settled();
    await new Promise((r) => setTimeout(r, 50));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("a blast-only item saves nothing: a later Back does not scroll", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    setScrollY(300);
    const first = renderTab();
    await settled();
    fireEvent.click(within(briefCard()).getByRole("button", { name: `Open ${BLAST_ONLY} at line 7` }));
    first.unmount();
    window.dispatchEvent(new PopStateEvent("popstate"));
    renderTab();
    await settled();
    await new Promise((r) => setTimeout(r, 50));
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
