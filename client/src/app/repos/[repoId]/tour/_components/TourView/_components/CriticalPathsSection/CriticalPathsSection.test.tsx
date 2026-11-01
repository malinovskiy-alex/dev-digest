/**
 * CriticalPathsSection — one file per row, or why there are none (plan step
 * 30b: AC-35, AC-38).
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { TourFileList } from "@devdigest/shared";
import onboarding from "../../../../../../../../../messages/en/onboarding.json";
import { CriticalPathsSection } from "./CriticalPathsSection";

afterEach(cleanup);

const renderList = (list: TourFileList) =>
  render(
    <NextIntlClientProvider locale="en" messages={{ onboarding }}>
      <CriticalPathsSection list={list} repoFullName="acme/payments-api" revision="abc123" />
    </NextIntlClientProvider>,
  );

describe("CriticalPathsSection", () => {
  it("AC-35 — rows path — reason, in the given order", () => {
    renderList({
      rows: [
        { path: "src/server.ts", reason: "boots the app", importers: 0, top_percent: 1 },
        { path: "src/routes.ts", reason: null, importers: 4, top_percent: 3 },
      ],
      gap: null,
    });
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("src/server.ts— boots the app");
    expect(rows[1]).toHaveTextContent("src/routes.ts— imported by 4 files · top 3% by rank");
  });

  it("AC-38 — no_edges → No critical paths — the import graph is empty", () => {
    renderList({ rows: [], gap: "no_edges" });
    expect(screen.getByText("No critical paths — the import graph is empty")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("F-57 — needs_index → says the repository is not indexed yet, not that the graph is empty", () => {
    renderList({ rows: [], gap: "needs_index" });
    expect(screen.getByText("No critical paths yet — the repository has not been indexed")).toBeInTheDocument();
    expect(screen.queryByText(/import graph is empty/)).toBeNull();
    expect(screen.queryByRole("listitem")).toBeNull();
  });
});
