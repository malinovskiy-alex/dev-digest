/**
 * ReviewFocusCard — plan step 17. Review focus as its own card (R-92) with the
 * behaviour it had inside the PR Brief block (R-51, R-52, R-36, R-53, R-76),
 * and its generating state (R-93, B-03: visual skeleton, `aria-busy`, no live
 * status of its own). Expected values come from the requirements.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReviewFocusItem } from "@devdigest/shared";
import type { BriefNavigation } from "@/lib/hooks/brief";
import brief from "../../../../../../../../messages/en/brief.json";
import { ReviewFocusCard } from "./ReviewFocusCard";

afterEach(cleanup);

const IN_DIFF = "src/api/public/webhooks.ts";
const BLAST_ONLY = "src/billing/invoice.ts";
const ITEMS: ReviewFocusItem[] = [
  { file: IN_DIFF, line: 61, reason: "Signature compare must be constant-time." },
  { file: BLAST_ONLY, line: 7, reason: "Called from the webhook path." },
];

let activate: ReturnType<typeof vi.fn>;

function renderCard(items: ReviewFocusItem[] | null) {
  activate = vi.fn();
  const nav: BriefNavigation = { activate, noticeKey: null, inDiff: (p) => p === IN_DIFF };
  return render(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ brief }}>
      <ReviewFocusCard items={items} nav={nav} />
    </NextIntlClientProvider>,
  );
}

const region = () => screen.getByRole("region", { name: /Review focus — read these first/ });

describe("ReviewFocusCard", () => {
  it("R-51, R-76, R-53 — heading with count, one row per item in the model's order; a click hands path and line on", () => {
    renderCard(ITEMS);
    const heading = within(region()).getByRole("heading", { name: /Review focus — read these first/ });
    expect(heading).toHaveTextContent("Review focus — read these first2");
    expect(region()).toHaveAttribute("aria-busy", "false");

    const items = within(within(region()).getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByRole("button", { name: `Open ${IN_DIFF} at line 61` })).toBeInTheDocument();
    expect(items[0]).toHaveTextContent(`${IN_DIFF}:61—Signature compare must be constant-time.`);
    expect(within(items[1]!).getByRole("button", { name: `Open ${BLAST_ONLY} at line 7` })).toBeInTheDocument();
    // the R-76 tag sits between the reference and the reason
    expect(items[1]).toHaveTextContent(`${BLAST_ONLY}:7via blast radius—Called from the webhook path.`);
    // R-76: only the file outside the PR's diff is tagged
    expect(within(items[1]!).getByText("via blast radius")).toBeInTheDocument();
    expect(within(items[0]!).queryByText("via blast radius")).not.toBeInTheDocument();

    fireEvent.click(within(items[1]!).getByRole("button", { name: `Open ${BLAST_ONLY} at line 7` }));
    expect(activate).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledWith(expect.any(String), BLAST_ONLY, 7);
  });

  it("R-52 — an empty list says so, with a zero count", () => {
    renderCard([]);
    expect(within(region()).getByText("No review focus items.")).toBeInTheDocument();
    expect(within(region()).getByRole("heading", { name: /Review focus — read these first/ })).toHaveTextContent(/0$/);
    expect(within(region()).queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("R-36, D-28 — a reason with HTML and markdown is literal text: no link", () => {
    const reason = '<a href="http://evil">click</a> [docs](http://e)';
    renderCard([{ file: IN_DIFF, line: 61, reason }]);
    expect(within(region()).getByText(reason)).toBeInTheDocument();
    expect(within(region()).queryAllByRole("link")).toHaveLength(0);
  });

  it("R-93, B-03 — generating: the heading, no count, no rows, aria-busy, and no live status of its own", () => {
    renderCard(null);
    const heading = within(region()).getByRole("heading", { name: "Review focus — read these first" });
    expect(heading).toHaveTextContent(/first$/);
    expect(region()).toHaveAttribute("aria-busy", "true");
    expect(within(region()).queryByRole("status")).not.toBeInTheDocument();
    expect(within(region()).queryByRole("listitem")).not.toBeInTheDocument();
    expect(within(region()).queryByText("No review focus items.")).not.toBeInTheDocument();
  });
});
