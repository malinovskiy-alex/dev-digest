import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { RunTrace } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/runs.json"; // apps/web/messages/en/runs.json

// Mock the trace hooks so the drawer renders without a query client / SSE.
const TRACE: RunTrace = {
  config: { agent: "Security", version: "1", provider: "openai", model: "gpt-4.1", pr: 482, source: "local" },
  stats: { duration_ms: 8200, tokens_in: 12000, tokens_out: 1500, cost_usd: 0.06, findings: 2, grounding: "2/2 passed" },
  prompt_assembly: { system: "You are a reviewer.", skills: "### skill", memory: null, specs: null, user: "Review PR #482" },
  tool_calls: [{ tool: "review_file", args: "src/config.ts", meta: "single-pass", ms: 1200 }],
  raw_output: '{"verdict":"request_changes"}',
  memory_pulled: [{ pr: 471, text: "rate-limit public endpoints" }],
  specs_read: [],
  log: [
    { t: "00.10", kind: "info", msg: "Starting review with agent Security" },
    { t: "00.90", kind: "result", msg: "Citation grounding: 2/2 passed" },
  ],
};

vi.mock("../../../../../../../lib/hooks/trace", () => ({
  useRunTrace: () => ({ data: TRACE, isLoading: false }),
}));
vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useRunEvents: () => ({ events: [], running: false }),
}));

import RunTraceDrawer from "./RunTraceDrawer";
import { TraceBody } from "./_components/TraceBody";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ runs: messages }}>
      <div data-theme="dark">{ui}</div>
    </NextIntlClientProvider>,
  );
}

describe("A5 Run Trace drawer (smoke)", () => {
  it("renders the trace tabs and stats", () => {
    renderWithIntl(<RunTraceDrawer runId="r1" agentName="Security" prNumber={482} onClose={() => {}} />);
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("Stats")).toBeInTheDocument();
    expect(screen.getByText("2/2 passed")).toBeInTheDocument();
    expect(screen.getByText("Tool calls")).toBeInTheDocument();
  });

  it("shows the COST stat tile for the run", () => {
    renderWithIntl(<RunTraceDrawer runId="r1" agentName="Security" prNumber={482} onClose={() => {}} />);
    expect(screen.getByText("COST")).toBeInTheDocument();
    expect(screen.getByText("$0.060")).toBeInTheDocument();
  });

  it("switches to the live log tab", () => {
    renderWithIntl(<RunTraceDrawer runId="r1" agentName="Security" prNumber={482} onClose={() => {}} />);
    fireEvent.click(screen.getByText("log"));
    // LiveLogStream renders its filter input
    expect(screen.getByPlaceholderText("Filter log…")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// L05 — the Trace tab's project-context parts, rendered through TraceBody.
// ---------------------------------------------------------------------------

const SEC_TEXT = "Every secret is read from the environment. UNIQUE-SEED-SENTENCE.";
const SPECS_BLOCK =
  `<untrusted source="docs/security-baseline.md">\n${SEC_TEXT}\n</untrusted>\n\n` +
  `<untrusted source="specs/huge.md">\n${"x".repeat(40)}\n</untrusted>`;

const L05_TRACE: RunTrace = {
  ...TRACE,
  prompt_assembly: { ...TRACE.prompt_assembly, specs: SPECS_BLOCK },
  specs_read: ["docs/security-baseline.md", "specs/huge.md"],
  specs_skipped: [
    { path: "docs/gone.md", reason: "not_found" },
    { path: "docs/locked.md", reason: "read_error" },
  ],
  specs_truncated: ["specs/huge.md"],
};

const SPECS_LABEL = "Project context — attached specs (untrusted)";

function renderBody(trace: RunTrace) {
  return renderWithIntl(<TraceBody trace={trace} findings={[]} />);
}

/** A trace-row path (`docs/…`, `specs/…`), in document order: Specs read first, then Specs skipped. */
const pathEls = () => screen.getAllByText(/^(docs|specs)\/[^ ]+\.md$/);

// F-10: navigator.clipboard is stubbed per test and put back afterwards.
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
afterEach(() => {
  if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
  else delete (navigator as { clipboard?: unknown }).clipboard;
});

describe("Run Trace drawer — project context (L05)", () => {
  it("lists Specs read in prompt order with the truncation mark, and Specs skipped with each reason (R-54, R-55, R-65)", () => {
    renderBody({
      ...L05_TRACE,
      specs_skipped: [...L05_TRACE.specs_skipped!, { path: "docs/over.md", reason: "budget" }],
    });
    expect(screen.getByText("Specs read")).toBeInTheDocument();
    expect(screen.getByText("Specs skipped")).toBeInTheDocument();
    expect(pathEls().map((el) => el.firstChild?.textContent)).toEqual([
      "docs/security-baseline.md",
      "specs/huge.md",
      "docs/gone.md",
      "docs/locked.md",
      "docs/over.md",
    ]);
    expect(screen.getByText("specs/huge.md")).toHaveTextContent(/^specs\/huge\.mdtruncated$/);
    expect(screen.getByText("docs/security-baseline.md")).toHaveTextContent(/^docs\/security-baseline\.md$/);
    expect(screen.getByText("docs/gone.md")).toHaveTextContent(/^docs\/gone\.mdnot found at HEAD$/);
    expect(screen.getByText("docs/locked.md")).toHaveTextContent(/^docs\/locked\.mdcould not be read$/);
    expect(screen.getByText("docs/over.md")).toHaveTextContent(/^docs\/over\.mdover the project-context size budget$/);
  });

  it("the specs row is labelled, weighs ~N tok, expands, copies and opens full screen (R-57, R-59, R-60)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderBody(L05_TRACE);
    fireEvent.click(screen.getByText("Prompt assembly")); // the section starts collapsed

    // every prompt row has one fullscreen and one copy button, in row order;
    // the fullscreen button's name says which row it belongs to (F-06)
    const fullscreens = screen.getAllByRole("button", { name: /^Open fullscreen: / });
    const specsIndex = fullscreens.findIndex((b) => b.getAttribute("aria-label") === `Open fullscreen: ${SPECS_LABEL}`);
    expect(specsIndex).toBeGreaterThanOrEqual(0);
    const copies = screen.getAllByRole("button", { name: "Copy" });
    expect(copies).toHaveLength(fullscreens.length);

    expect(screen.getByText(`~${Math.ceil(SPECS_BLOCK.length / 4)} tok`)).toBeInTheDocument();
    expect(screen.queryByText(/UNIQUE-SEED-SENTENCE/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(SPECS_LABEL));
    expect(screen.getByText(/UNIQUE-SEED-SENTENCE/)).toBeInTheDocument();

    fireEvent.click(copies[specsIndex]!);
    expect(writeText).toHaveBeenCalledWith(SPECS_BLOCK);

    fireEvent.click(screen.getByRole("button", { name: `Open fullscreen: ${SPECS_LABEL}` }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(SPECS_LABEL)).toBeInTheDocument();
    expect(within(dialog).getAllByText(/UNIQUE-SEED-SENTENCE/).length).toBeGreaterThan(0);
  });

  it("an old trace without the L05 fields shows no specs row, no Specs skipped, and Specs read: none (R-61)", () => {
    renderBody(TRACE);
    fireEvent.click(screen.getByText("Prompt assembly"));
    expect(screen.getByText("System")).toBeInTheDocument(); // the section really is open
    expect(screen.queryByText(SPECS_LABEL)).not.toBeInTheDocument();
    expect(screen.queryByText("Specs skipped")).not.toBeInTheDocument();
    expect(screen.getByText("Specs read")).toBeInTheDocument();
    expect(screen.getByText("none")).toBeInTheDocument();
    expect(screen.queryAllByText(/^(docs|specs)\/[^ ]+\.md$/)).toEqual([]);
  });
});
