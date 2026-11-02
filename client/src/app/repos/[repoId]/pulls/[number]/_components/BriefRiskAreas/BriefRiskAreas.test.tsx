/**
 * BriefRiskAreas — plan step 25c: title, severity text and first ref (R-49);
 * the expand control (R-50); the empty text (R-52); a ref without a line
 * navigates with `line: null` (R-55); model text stays text (R-36, D-28).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Risk } from "@devdigest/shared";
import type { BriefNavigation } from "@/lib/hooks/brief";
import brief from "../../../../../../../../messages/en/brief.json";
import { BriefRiskAreas, BriefRiskAreasSkeleton } from ".";

afterEach(cleanup);

const RISKS: Risk[] = [
  {
    kind: "security",
    title: "Signature check can be bypassed",
    explanation: "The compare short-circuits.\nUse a constant-time compare.",
    severity: "high",
    file_refs: ["src/api/public/webhooks.ts:61-74", "src/lib/crypto.ts", "src/billing/invoice.ts:7"],
  },
  {
    kind: "data",
    title: "Invoice rounding changes",
    explanation: "Totals may differ by a cent.",
    severity: "low",
    file_refs: ["src/billing/invoice.ts:40"],
  },
];

const CHANGED = new Set(["src/api/public/webhooks.ts", "src/lib/crypto.ts"]);

function renderRisks(risks: Risk[], noticeKey: string | null = null) {
  const activate = vi.fn();
  const nav: BriefNavigation = { activate, noticeKey, inDiff: (p) => CHANGED.has(p) };
  render(
    <NextIntlClientProvider locale="en" messages={{ brief }}>
      <BriefRiskAreas risks={risks} nav={nav} />
    </NextIntlClientProvider>,
  );
  return activate;
}

describe("BriefRiskAreas", () => {
  it("R-49 — each risk shows its title, its severity as text, and its first file ref in <path>:<lines> form", () => {
    renderRisks(RISKS);
    const first = screen.getByText("Signature check can be bypassed").closest("li")!;
    expect(within(first).getByText("High severity")).toBeInTheDocument();
    const ref = within(first).getByRole("button", { name: "Open src/api/public/webhooks.ts at line 61" });
    expect(ref).toHaveTextContent(/^src\/api\/public\/webhooks\.ts:61-74$/);
    // only the first ref while collapsed
    expect(within(first).queryByRole("button", { name: /Open src\/lib\/crypto\.ts/ })).not.toBeInTheDocument();

    const second = screen.getByText("Invoice rounding changes").closest("li")!;
    expect(within(second).getByText("Low severity")).toBeInTheDocument();
    expect(within(second).getByRole("button", { name: "Open src/billing/invoice.ts at line 40" })).toHaveTextContent(
      "src/billing/invoice.ts:40",
    );
    // R-76 on a risk ref: a blast-map file is tagged
    expect(within(second).getByText("via blast radius")).toBeInTheDocument();
    // the list order is the model's order
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("R-50 — the expand control toggles aria-expanded, the explanation and every ref", () => {
    renderRisks(RISKS);
    const expand = screen.getByRole("button", { name: "Show details for Signature check can be bypassed" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/The compare short-circuits/)).not.toBeInTheDocument();

    fireEvent.click(expand);
    expect(expand).toHaveAttribute("aria-expanded", "true");
    const details = document.getElementById(expand.getAttribute("aria-controls")!)!;
    expect(details).not.toBeNull();
    expect(within(details).getByText(/The compare short-circuits/)).toBeInTheDocument();
    expect(within(details).getByRole("button", { name: "Open src/api/public/webhooks.ts at line 61" })).toBeInTheDocument();
    expect(within(details).getByRole("button", { name: "Open src/lib/crypto.ts" })).toBeInTheDocument();
    expect(within(details).getByRole("button", { name: "Open src/billing/invoice.ts at line 7" })).toBeInTheDocument();

    fireEvent.click(expand);
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/The compare short-circuits/)).not.toBeInTheDocument();
    // the other risk is untouched
    expect(screen.getByRole("button", { name: "Show details for Invoice rounding changes" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("R-53, R-55 — a ref navigates with its first line; a ref without a line navigates with line null", () => {
    const activate = renderRisks(RISKS);
    fireEvent.click(screen.getByRole("button", { name: "Open src/api/public/webhooks.ts at line 61" }));
    expect(activate).toHaveBeenLastCalledWith(expect.any(String), "src/api/public/webhooks.ts", 61);

    fireEvent.click(screen.getByRole("button", { name: "Show details for Signature check can be bypassed" }));
    fireEvent.click(screen.getByRole("button", { name: "Open src/lib/crypto.ts" }));
    expect(activate).toHaveBeenLastCalledWith(expect.any(String), "src/lib/crypto.ts", null);
    // two different refs → two different notice keys (one notice at a time, D-30)
    const keys = activate.mock.calls.map((c) => c[0]);
    expect(new Set(keys).size).toBe(2);
  });

  it("R-56 — the notice shows next to the ref whose key is the active notice, and nowhere else", () => {
    const activate = renderRisks(RISKS);
    fireEvent.click(screen.getByRole("button", { name: "Open src/billing/invoice.ts at line 40" }));
    const key = activate.mock.calls[0]![0] as string;
    cleanup();
    renderRisks(RISKS, key);
    const second = screen.getByText("Invoice rounding changes").closest("li")!;
    expect(within(second).getByRole("status")).toHaveTextContent("File not in this PR's diff");
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("R-52 — no risks: 'No notable risks flagged.'", () => {
    renderRisks([]);
    expect(screen.getByText("No notable risks flagged.")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("R-36 — a title and explanation with HTML render as text: no img, no link", () => {
    const evil: Risk = {
      kind: "x",
      title: '<img src=x onerror="alert(1)"> title',
      explanation: "[click](http://evil) <a href='http://evil'>a</a>",
      severity: "medium",
      file_refs: ["src/a.ts"],
    };
    renderRisks([evil]);
    expect(screen.getByText('<img src=x onerror="alert(1)"> title')).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Show details for/ }));
    expect(screen.getByText("[click](http://evil) <a href='http://evil'>a</a>")).toBeInTheDocument();
    expect(document.body.querySelector("img")).toBeNull();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("R-05, F-16 — the skeleton for the Intent card slot is a 'Generating…' status", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ brief }}>
        <BriefRiskAreasSkeleton />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("status", { name: "Generating…" })).toBeInTheDocument();
  });
});
