import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import type { PrFile } from "@/lib/types";
import shell from "../../../../messages/en/shell.json";
import type { DiffFindingApi } from "../findings";
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
