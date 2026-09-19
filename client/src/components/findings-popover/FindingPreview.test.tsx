/**
 * FindingPreview — the read-only half of the findings feature. Accept/Reject
 * belong to the expanded run card on the PR detail page; this preview sits in
 * a hover panel, so it must offer no controls at all — not a button, and not
 * a link either, which would become a stray tab stop between two list rows.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { FindingRecord } from "@devdigest/shared";
import { FindingPreview } from "./FindingPreview";

afterEach(cleanup);

const FINDING: FindingRecord = {
  id: "f1",
  severity: "CRITICAL",
  category: "security",
  title: "Hardcoded Stripe secret key in commit",
  file: "src/config.ts",
  start_line: 12,
  end_line: 12,
  rationale: "Line 12 contains a literal `sk_live_` string, which is a **secret key**.",
  suggestion: null,
  confidence: 0.98,
  kind: "finding",
  trifecta_components: null,
  evidence: null,
  review_id: "r1",
  accepted_at: null,
  dismissed_at: null,
};

describe("FindingPreview", () => {
  it("shows what the finding is, where, and how sure the model was", () => {
    render(<FindingPreview f={FINDING} />);
    expect(screen.getByText("Hardcoded Stripe secret key in commit")).toBeInTheDocument();
    expect(screen.getByText("security")).toBeInTheDocument();
    expect(screen.getByText("src/config.ts:12")).toBeInTheDocument();
    expect(screen.getByText("98% conf")).toBeInTheDocument();
  });

  it("flattens the markdown rationale into plain preview text", () => {
    render(<FindingPreview f={FINDING} />);
    expect(
      screen.getByText("Line 12 contains a literal sk_live_ string, which is a secret key."),
    ).toBeInTheDocument();
  });

  it("renders a line range when the finding spans several lines", () => {
    render(<FindingPreview f={{ ...FINDING, start_line: 61, end_line: 74 }} />);
    expect(screen.getByText("src/config.ts:61-74")).toBeInTheDocument();
  });

  it("offers no controls", () => {
    render(<FindingPreview f={FINDING} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
