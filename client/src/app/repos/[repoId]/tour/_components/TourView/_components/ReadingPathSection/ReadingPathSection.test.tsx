/**
 * ReadingPathSection — a numbered list of at most 8, or why there is none
 * (plan step 30b: AC-48, AC-49, AC-51).
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { TourFileList } from "@devdigest/shared";
import onboarding from "../../../../../../../../../messages/en/onboarding.json";
import { ReadingPathSection } from "./ReadingPathSection";

afterEach(cleanup);

const renderList = (list: TourFileList, indexReasonText: string | null = null) =>
  render(
    <NextIntlClientProvider locale="en" messages={{ onboarding }}>
      <ReadingPathSection list={list} repoFullName="acme/payments-api" revision="abc123" indexReasonText={indexReasonText} />
    </NextIntlClientProvider>,
  );

describe("ReadingPathSection", () => {
  it("AC-48, AC-49 — a numbered list, each item with its path and a why", () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ path: `src/f${i + 1}.ts`, reason: i === 0 ? "start here" : null, importers: 8 - i, top_percent: i + 1 }));
    renderList({ rows, gap: null });
    const list = screen.getByRole("list");
    expect(list.tagName).toBe("OL");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(8);
    // UI-D-14 (F-46): a number badge without a dot, the path on one line and
    // the why on the next, with no "— " joining them. Each part on its own.
    const parts = (item: HTMLElement, n: number, path: string, why: string) => {
      expect(within(item).getByText(String(n), { exact: true })).toBeInTheDocument();
      const code = within(item).getByText(path);
      expect(code.tagName).toBe("CODE");
      const reason = within(item).getByText(why, { exact: true });
      expect(reason).not.toBe(code);
      expect(code).not.toContainElement(reason);
      expect(item.textContent!.startsWith(`${n}.`)).toBe(false); // no "1." badge
      expect(item.textContent).not.toContain("—");
    };
    parts(items[0]!, 1, "src/f1.ts", "start here");
    parts(items[1]!, 2, "src/f2.ts", "imported by 7 files · top 2% by rank");
    parts(items[7]!, 8, "src/f8.ts", "imported by 1 files · top 8% by rank");
  });

  it("AC-51 — not_ranked with a reason → the message with the reason", () => {
    renderList({ rows: [], gap: "not_ranked" }, "the repository has not been indexed yet");
    expect(screen.getByText(/^No reading path — the repository has not been ranked yet/)).toHaveTextContent(
      "the repository has not been indexed yet",
    );
  });
});
