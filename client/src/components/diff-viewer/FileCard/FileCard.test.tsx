import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import type { PrFile } from "@/lib/types";
import shell from "../../../../messages/en/shell.json";
import type { DiffFindingApi } from "../findings";
import type { DiffFocus } from "../focus";
import { FileCard } from "./FileCard";

afterEach(cleanup);

const FILE: PrFile = {
  path: "src/config.ts",
  additions: 1,
  deletions: 0,
  patch: '@@ -10,3 +10,4 @@\n   port: 3000,\n+  stripeKey: "sk_live_xxx",\n   redisUrl: x,',
};

function finding(o: Partial<FindingRecord> & { id: string }): FindingRecord {
  return {
    severity: "CRITICAL",
    category: "security",
    title: "Hardcoded Stripe secret key",
    file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    rationale: "A live key is committed.",
    suggestion: null,
    confidence: 0.95,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...o,
  };
}

const api = (findings: FindingRecord[]): DiffFindingApi => ({
  findings,
  renderFinding: (f) => <div>{f.title}</div>,
});

function renderCard(findings?: DiffFindingApi) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ shell }}>
      <FileCard file={FILE} findings={findings} />
    </NextIntlClientProvider>,
  );
}

describe("FileCard — review findings", () => {
  it("dots the header, labels the cited line and renders the finding under it", () => {
    renderCard(api([finding({ id: "f1" })]));

    expect(screen.getByRole("img", { name: "1 review finding" })).toBeInTheDocument();
    expect(screen.getByText("blocker")).toBeInTheDocument();

    const code = screen.getByText('stripeKey: "sk_live_xxx",');
    const card = screen.getByText("Hardcoded Stripe secret key");
    // the card follows the cited line in document order
    expect(code.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // ...and comes before the next code line
    const next = screen.getByText("redisUrl: x,");
    expect(card.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText("Findings outside the shown lines")).not.toBeInTheDocument();
  });

  it("shows no dot and no label when the file has no findings", () => {
    renderCard(api([finding({ id: "other", file: "src/other.ts" })]));
    expect(screen.getByText("src/config.ts")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "1 review finding" })).not.toBeInTheDocument();
    expect(screen.queryByText("blocker")).not.toBeInTheDocument();
    expect(screen.queryByText("Hardcoded Stripe secret key")).not.toBeInTheDocument();
  });

  it("puts a finding whose line is not in the patch under the unanchored caption", () => {
    renderCard(api([finding({ id: "far", start_line: 400, title: "Far away", severity: "WARNING" })]));
    const caption = screen.getByText("Findings outside the shown lines");
    const card = screen.getByText("Far away");
    expect(caption.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // the file still carries the dot, but no line carries a label
    expect(screen.getByRole("img", { name: "1 review finding" })).toBeInTheDocument();
    expect(screen.queryByText("warning")).not.toBeInTheDocument();
  });

  it("summarises the file's findings in the header: top severity's icon colour and the total", () => {
    renderCard(
      api([
        finding({ id: "w", severity: "WARNING", title: "A warning" }),
        finding({ id: "c", severity: "CRITICAL", title: "A blocker" }),
      ]),
    );
    const badge = screen.getByRole("img", { name: "2 review findings" });
    expect(badge).toHaveTextContent("2");
  });

  it("hides the cards but keeps the badge and the line label when showFindings is false", () => {
    renderCard({ ...api([finding({ id: "f1" })]), showFindings: false });
    expect(screen.getByRole("img", { name: "1 review finding" })).toBeInTheDocument();
    expect(screen.getByText("blocker")).toBeInTheDocument();
    expect(screen.queryByText("Hardcoded Stripe secret key")).not.toBeInTheDocument();
  });
});

// ---- L05 PR Brief: focus target (plan step 25f; R-53, R-54, R-57, R-59, D-33, F-07) ----

/** A file over AUTO_EXPAND_MAX_LINES (200): it starts collapsed unless focused. */
const BIG: PrFile = {
  path: "src/api/public/webhooks.ts",
  additions: 210,
  deletions: 0,
  patch: ["@@ -0,0 +1,210 @@", ...Array.from({ length: 210 }, (_, i) => `+big line ${i + 1}`)].join("\n"),
};

describe("FileCard — focus target", () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    scrollIntoView = vi.fn();
    // jsdom has no layout, so no scrollIntoView
    Element.prototype.scrollIntoView = scrollIntoView as unknown as Element["scrollIntoView"];
  });

  function renderFocused(focus?: DiffFocus, file: PrFile = BIG) {
    return render(
      <NextIntlClientProvider locale="en" messages={{ shell }}>
        <FileCard file={file} focus={focus} />
      </NextIntlClientProvider>,
    );
  }

  it("without a focus, a file over 200 lines starts collapsed (baseline for the cases below)", () => {
    renderFocused(undefined);
    expect(screen.getByText(BIG.path)).toBeInTheDocument();
    expect(screen.queryByText("big line 150")).not.toBeInTheDocument();
  });

  it("R-53, R-54 — forces a large file open, highlights the line, scrolls it into view, focuses it, reports handled once", () => {
    const onHandled = vi.fn();
    renderFocused({ path: BIG.path, line: 150, onHandled });
    const row = screen.getByText("big line 150").closest("[aria-current]") as HTMLElement;
    expect(row).not.toBeNull();
    expect(row).toHaveAttribute("aria-current", "location");
    expect(row).toHaveAttribute("tabindex", "-1");
    expect(row).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(row);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
    expect(onHandled).toHaveBeenCalledTimes(1);
    // exactly one highlighted row
    expect(document.querySelectorAll("[aria-current]")).toHaveLength(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("R-54 — the target is matched on the new-side line number, not the row index", () => {
    const file: PrFile = {
      path: "src/x.ts",
      additions: 1,
      deletions: 1,
      patch: "@@ -40,3 +40,3 @@\n ctx forty\n-old forty-one\n+new forty-one\n ctx forty-two",
    };
    renderFocused({ path: file.path, line: 41 }, file);
    const row = screen.getByText("new forty-one").closest("[aria-current]");
    expect(row).not.toBeNull();
    expect(screen.getByText("old forty-one").closest("[aria-current]")).toBeNull();
    // a context line is a valid target too
    cleanup();
    renderFocused({ path: file.path, line: 42 }, file);
    expect(screen.getByText("ctx forty-two").closest("[aria-current]")).not.toBeNull();
  });

  it("R-57 — a line outside every hunk: the file opens, the notice shows, the header is scrolled to and focused", () => {
    const onHandled = vi.fn();
    renderFocused({ path: BIG.path, line: 500, onHandled });
    expect(screen.getByRole("status")).toHaveTextContent("Line 500 is not in the changed lines of this file");
    expect(screen.getByText("big line 1")).toBeInTheDocument(); // opened
    const header = screen.getByText(BIG.path).closest("[tabindex]") as HTMLElement;
    expect(header).toHaveAttribute("tabindex", "-1");
    expect(header).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(header);
    expect(document.querySelectorAll("[aria-current]")).toHaveLength(0);
    expect(onHandled).toHaveBeenCalledTimes(1);
  });

  it("R-57 — a file with no patch text and a line: notice + header focus", () => {
    renderFocused({ path: "bin/logo.png", line: 3 }, { path: "bin/logo.png", additions: 0, deletions: 0 });
    expect(screen.getByRole("status")).toHaveTextContent("Line 3 is not in the changed lines of this file");
    expect(screen.getByText("bin/logo.png").closest("[tabindex]")).toHaveFocus();
  });

  it("D-29 — a focus without a line goes to the header with no notice", () => {
    renderFocused({ path: BIG.path, line: null });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText(BIG.path).closest("[tabindex]")).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("F-07 — an already handled target neither forces the file open nor scrolls", () => {
    const onHandled = vi.fn();
    renderFocused({ path: BIG.path, line: 150, handled: true, onHandled });
    expect(screen.queryByText("big line 150")).not.toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(onHandled).not.toHaveBeenCalled();
  });
});
