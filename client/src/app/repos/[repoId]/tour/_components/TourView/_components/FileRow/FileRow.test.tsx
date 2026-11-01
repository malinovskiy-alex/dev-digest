/**
 * FileRow — path, reason, and "Open" at the tour revision (plan step 30b:
 * AC-35, AC-36, AC-37, AC-49, AC-78, AC-79).
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { TourFileRow } from "@devdigest/shared";
import onboarding from "../../../../../../../../../messages/en/onboarding.json";
import { FileRow } from "./FileRow";

afterEach(cleanup);

const renderRow = (row: TourFileRow, revision: string | null = "abc123") =>
  render(
    <NextIntlClientProvider locale="en" messages={{ onboarding }}>
      <ul>
        <FileRow row={row} repoFullName="acme/payments-api" revision={revision} />
      </ul>
    </NextIntlClientProvider>,
  );

describe("FileRow", () => {
  it("AC-35 — a row reads path — reason", () => {
    renderRow({ path: "src/a.ts", reason: "the entry point", importers: 3, top_percent: 5 });
    expect(screen.getByRole("listitem")).toHaveTextContent("src/a.ts— the entry point");
  });

  it("AC-36, AC-49 — no model reason → imported by N files · top P% by rank", () => {
    renderRow({ path: "src/a.ts", reason: null, importers: 3, top_percent: 5 });
    expect(screen.getByText(/imported by 3 files · top 5% by rank/)).toBeInTheDocument();
  });

  it("AC-37, AC-79 — Open links to the file on GitHub at the revision, in a new tab, named with the path", () => {
    renderRow({ path: "src/a.ts", reason: null, importers: 3, top_percent: 5 });
    const [open] = screen.getAllByRole("link", { name: /Open src\/a\.ts/ });
    expect(open).toHaveAttribute("href", "https://github.com/acme/payments-api/blob/abc123/src/a.ts");
    expect(open).toHaveAttribute("target", "_blank");
  });

  it("AC-78 — a 120-char path is cut in the middle with … and keeps the full path in its tooltip", () => {
    const long = `src/${"deep/".repeat(22)}file.ts`.slice(0, 120);
    expect(long).toHaveLength(120);
    renderRow({ path: long, reason: "r", importers: 1, top_percent: 1 });
    const shown = screen.getByTitle(long);
    expect(shown.textContent).toContain("…");
    expect(shown.textContent!.length).toBeLessThan(120);
    expect(shown.textContent!.startsWith("src/")).toBe(true);
    expect(shown.textContent!.endsWith(long.slice(-4))).toBe(true);
  });
});
