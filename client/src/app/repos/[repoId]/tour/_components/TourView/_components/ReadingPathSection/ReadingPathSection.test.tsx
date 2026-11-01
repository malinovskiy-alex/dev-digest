/**
 * ReadingPathSection — a numbered list of at most 8, or why there is none
 * (plan step 30b: AC-48, AC-49, AC-51).
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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
    expect(items[0]).toHaveTextContent("1.src/f1.ts— start here");
    expect(items[1]).toHaveTextContent("2.src/f2.ts— imported by 7 files · top 2% by rank");
    expect(items[7]).toHaveTextContent(/^8\./);
  });

  it("AC-51 — not_ranked with a reason → the message with the reason", () => {
    renderList({ rows: [], gap: "not_ranked" }, "the repository has not been indexed yet");
    expect(screen.getByText(/^No reading path — the repository has not been ranked yet/)).toHaveTextContent(
      "the repository has not been indexed yet",
    );
  });
});
