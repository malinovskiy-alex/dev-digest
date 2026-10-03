import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, PrFile, ReviewRecord, SmartDiff } from "@devdigest/shared";
import prReview from "../../../../../../../../messages/en/prReview.json";
import shell from "../../../../../../../../messages/en/shell.json";

const mutate = vi.fn();
let smartDiff: SmartDiff | undefined;
let reviews: ReviewRecord[] | undefined;
let smartDiffLoading = false;

vi.mock("@/lib/hooks/reviews", () => ({
  usePrComments: () => ({ data: [] }),
  useCreatePrComment: () => ({ isPending: false, mutateAsync: vi.fn() }),
  usePrReviews: () => ({ data: reviews }),
  useSmartDiff: () => ({ data: smartDiff, isLoading: smartDiffLoading }),
  useFindingAction: () => ({ mutate, isPending: false }),
}));

import { DiffTab } from "./DiffTab";

afterEach(cleanup);

const patch = (text: string) => `@@ -1,1 +1,2 @@\n context\n+${text}`;

/** GitHub order — deliberately not the role order. */
const FILES: PrFile[] = [
  { path: "pnpm-lock.yaml", additions: 120, deletions: 40, patch: patch("lock line") },
  { path: "README.md", additions: 3, deletions: 1, patch: patch("readme line") },
  {
    path: "src/config.ts",
    additions: 1,
    deletions: 0,
    patch: '@@ -10,3 +10,4 @@\n   port: 3000,\n+  stripeKey: "sk_live_xxx",\n   redisUrl: x,',
  },
  { path: "vitest.config.ts", additions: 2, deletions: 2, patch: patch("config line") },
  { path: "src/config.test.ts", additions: 25, deletions: 0, patch: patch("test line") },
];

const sd = (path: string, finding_lines: number[] = []) => {
  const f = FILES.find((x) => x.path === path)!;
  return { path, additions: f.additions, deletions: f.deletions, finding_lines };
};

const SMART_DIFF: SmartDiff = {
  review_id: "rev-1",
  groups: [
    { role: "core", files: [sd("src/config.ts", [11])] },
    { role: "tests", files: [sd("src/config.test.ts")] },
    { role: "wiring", files: [sd("vitest.config.ts")] },
    { role: "docs", files: [sd("README.md")] },
    { role: "boilerplate", files: [sd("pnpm-lock.yaml")] },
  ],
  split_suggestion: { too_big: false, total_lines: 194, proposed_splits: [] },
};

const FINDING: FindingRecord = {
  id: "f-11",
  severity: "CRITICAL",
  category: "security",
  title: "Hardcoded Stripe secret key",
  file: "src/config.ts",
  start_line: 11,
  end_line: 11,
  rationale: "A live Stripe key is committed in source.",
  suggestion: "Move the key to an environment variable.",
  confidence: 0.95,
  kind: "finding",
  trifecta_components: null,
  evidence: null,
  review_id: "rev-1",
  accepted_at: null,
  dismissed_at: null,
};

const REVIEW: ReviewRecord = {
  id: "rev-1",
  pr_id: "pr-1",
  agent_id: "ag-1",
  run_id: "run-1",
  kind: "review",
  verdict: "request_changes",
  summary: "s",
  score: 40,
  model: "m",
  created_at: "2026-01-01T00:00:00Z",
  findings: [FINDING],
};

function renderTab() {
  render(
    <NextIntlClientProvider locale="en" messages={{ prReview, shell }}>
      <DiffTab prId="pr-1" filesCount={FILES.length} files={FILES} canComment repoFullName="acme/api" headSha="abc" />
    </NextIntlClientProvider>,
  );
}

/** True when the elements appear in the DOM in exactly this order. */
function inDocumentOrder(els: HTMLElement[]): boolean {
  return els.every(
    (el, i) => i === 0 || !!(els[i - 1]!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING),
  );
}

beforeEach(() => {
  mutate.mockClear();
  smartDiff = SMART_DIFF;
  smartDiffLoading = false;
  reviews = [REVIEW];
});

describe("DiffTab — Smart order", () => {
  it("groups by role, collapses docs/boilerplate, counts and renders the finding inline", () => {
    renderTab();

    // (f) caption + summary
    expect(screen.getByText("Reviewer-ordered diff")).toBeInTheDocument();
    expect(screen.getByText("5 files · +151 −43")).toBeInTheDocument();

    // (a) groups in role order
    const labels = ["Core", "Tests", "Wiring", "Docs", "Boilerplate"].map((l) => screen.getByText(l));
    expect(inDocumentOrder(labels)).toBe(true);

    // (b) docs and boilerplate start collapsed; core/tests/wiring are open
    expect(screen.queryByText("pnpm-lock.yaml")).not.toBeInTheDocument();
    expect(screen.queryByText("README.md")).not.toBeInTheDocument();
    expect(screen.getByText("src/config.ts")).toBeInTheDocument();
    expect(screen.getByText("src/config.test.ts")).toBeInTheDocument();
    expect(screen.getByText("vitest.config.ts")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Boilerplate/ }));
    expect(screen.getByText("pnpm-lock.yaml")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Docs/ }));
    expect(screen.getByText("README.md")).toBeInTheDocument();

    // (c) the Core header counts one file with findings
    expect(screen.getByRole("img", { name: "1 file has findings" })).toHaveTextContent("1");
    expect(screen.getByRole("img", { name: "1 review finding" })).toBeInTheDocument();

    // (d) the finding renders under its line, labelled, and its actions work
    expect(screen.getByText("Hardcoded Stripe secret key")).toBeInTheDocument();
    expect(screen.getByText("blocker")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Accept" })[0]!);
    expect(mutate).toHaveBeenCalledWith({ findingId: "f-11", action: "accept", prId: "pr-1" });
  });

  it("hides and shows the finding cards, keeping the line label", () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Hide findings (1)" }));
    expect(screen.queryByText("Hardcoded Stripe secret key")).not.toBeInTheDocument();
    expect(screen.getByText("blocker")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "1 review finding" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show findings (1)" }));
    expect(screen.getByText("Hardcoded Stripe secret key")).toBeInTheDocument();
  });

  it("switches to the flat GitHub order and back, keeping the inline finding", () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Original order" }));

    // (e) flat, GitHub order, no group headers, finding still inline
    expect(screen.getByText("Files changed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Boilerplate/ })).not.toBeInTheDocument();
    expect(inDocumentOrder(FILES.map((f) => screen.getByText(f.path)))).toBe(true);
    expect(screen.getByText("Hardcoded Stripe secret key")).toBeInTheDocument();
    expect(screen.getByText("blocker")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Smart order" }));
    expect(screen.getByText("Reviewer-ordered diff")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Boilerplate/ })).toBeInTheDocument();
  });
});

describe("DiffTab — no grouping yet", () => {
  it("shows a placeholder, not the flat diff, while the smart diff loads", () => {
    // Rendering every file flat and then again as groups froze the tab on a
    // 100-file PR, so nothing heavy renders until the grouping is known.
    smartDiff = undefined;
    smartDiffLoading = true;
    renderTab();
    expect(screen.getByLabelText("Grouping files by role…")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText(FILES[0]!.path)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Smart order" })).toBeDisabled();
  });

  it("renders the files flat and disables the toggle when the smart diff is unavailable", () => {
    smartDiff = undefined;
    renderTab();
    // (g)
    expect(screen.getByText("Files changed")).toBeInTheDocument();
    expect(inDocumentOrder(FILES.map((f) => screen.getByText(f.path)))).toBe(true);
    expect(screen.getByRole("button", { name: "Smart order" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Original order" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Original order" })).toHaveAttribute("aria-pressed", "true");
    // the server has not named the latest review yet, so no finding renders inline
    expect(screen.queryByText("Hardcoded Stripe secret key")).not.toBeInTheDocument();
  });
});
