import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrHistory } from "@devdigest/shared";
import blast from "../../../../../../../../../../messages/en/blast.json";
import { githubPrUrl } from "@/lib/github-urls";

const h = vi.hoisted(() => ({
  history: {} as { data?: unknown; isLoading: boolean; error: Error | null; refetch: () => void },
}));

vi.mock("@/lib/hooks/blast", () => ({
  usePrHistory: () => h.history,
}));

import { PriorPrs } from "./PriorPrs";

const HISTORY: PrHistory = {
  history: [
    {
      pr_number: 6,
      title: "Scope repo-intel by workspace",
      merged_at: "2026-04-01T12:00:00.000Z",
      author: "alex",
      files_overlap: ["a.ts", "b.ts", "c.ts", "d.ts"],
      notes: "4 shared files",
    },
    {
      pr_number: 5,
      title: "Add context helper",
      merged_at: "2026-03-01T12:00:00.000Z",
      author: "sam",
      files_overlap: ["a.ts"],
      notes: "1 shared file",
    },
  ],
  candidates: 12,
  unchecked: 0,
  github_unavailable: false,
};

function setData(data: PrHistory) {
  h.history = { data, isLoading: false, error: null, refetch: vi.fn() };
}

function renderPriorPrs(repoFullName: string | null = "acme/api") {
  return render(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ blast }}>
      <PriorPrs prId="pr-1" repoFullName={repoFullName} />
    </NextIntlClientProvider>,
  );
}

const header = () => screen.getByRole("button", { name: /Prior PRs touching these files/ });

beforeEach(() => setData(HISTORY));
afterEach(() => cleanup());

describe("PriorPrs", () => {
  it("is collapsed with a count, then lists the PRs with links, dates and overlap", () => {
    renderPriorPrs();
    // (a)
    expect(header()).toHaveAttribute("aria-expanded", "false");
    expect(header()).toHaveTextContent("2");
    expect(screen.queryByText("Scope repo-intel by workspace")).not.toBeInTheDocument();

    // (b)
    fireEvent.click(header());
    expect(header()).toHaveAttribute("aria-expanded", "true");
    const link = screen.getByRole("link", { name: "Open PR #6 on GitHub" });
    expect(link).toHaveAttribute("href", githubPrUrl("acme/api", 6));
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Scope repo-intel by workspace")).toBeInTheDocument();
    expect(screen.getByText("updated Apr 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("4 shared files")).toBeInTheDocument();
    expect(screen.getByText("1 shared file")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByText("Compared against 12 merged PRs DevDigest has synced.")).toBeInTheDocument();
  });

  it("renders PR numbers as plain text without a repo name", () => {
    renderPriorPrs(null);
    fireEvent.click(header());
    expect(screen.getByText("#6")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("says none were found, with the scope note", () => {
    setData({ history: [], candidates: 5, unchecked: 0, github_unavailable: false });
    renderPriorPrs();
    fireEvent.click(header());
    expect(screen.getByText("No merged PR DevDigest has synced touched these files.")).toBeInTheDocument();
    expect(screen.getByText("Compared against 5 merged PRs DevDigest has synced.")).toBeInTheDocument();
  });

  it("explains unchecked candidates — GitHub down vs. budget", () => {
    setData({ history: [], candidates: 5, unchecked: 3, github_unavailable: true });
    renderPriorPrs();
    fireEvent.click(header());
    expect(screen.getByRole("status")).toHaveTextContent(
      "3 merged PRs could not be checked: GitHub is unreachable or no token is set.",
    );
    cleanup();

    setData({ ...HISTORY, unchecked: 2, github_unavailable: false });
    renderPriorPrs();
    fireEvent.click(header());
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 merged PRs were not checked yet — reopen to continue.",
    );
  });

  it("shows an error with a retry", () => {
    const refetch = vi.fn();
    h.history = { data: undefined, isLoading: false, error: new Error("boom"), refetch };
    renderPriorPrs();
    fireEvent.click(header());
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load prior PRs.");
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });
});
