/**
 * PR detail page — plan step 25g: the page's router wiring for the PR Brief
 * navigation. A focus navigation PUSHES a history entry (so Back returns to
 * Overview, R-77, D-32); a tab click REPLACES and drops `file`/`line`; a
 * reloaded `?tab=diff&file=&line=` hands the focus to Files changed (R-59).
 *
 * Only the page's own wiring is under test, so its child tabs are stubbed to
 * expose the callbacks the page passes them; the router and data hooks are
 * mocked at the module boundary.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import shell from "../../../../../../messages/en/shell.json";

const h = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ repoId: "r1", number: "7" }),
  useRouter: () => ({ push: h.push, replace: h.replace }),
  useSearchParams: () => h.search,
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/repo-not-found", () => ({ RepoNotFound: () => null }));
vi.mock("@/lib/repo-context", () => ({
  useActiveRepo: () => ({ activeRepo: { full_name: "acme/api" } }),
  useRepoNotFound: () => false,
}));

const PR = {
  id: "pr-1",
  number: 7,
  body: null,
  head_sha: "abc1234",
  status: "open",
  files_count: 2,
  commits: [],
  files: [
    { path: "src/a.ts", additions: 1, deletions: 0, patch: "@@ -1 +1 @@\n+a" },
    { path: "src/b.ts", additions: 1, deletions: 0, patch: "@@ -1 +1 @@\n+b" },
  ],
};

vi.mock("@/lib/hooks", () => ({
  usePulls: () => ({ data: [{ id: "pr-1", number: 7 }], isLoading: false }),
  usePullDetail: () => ({ data: PR, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
}));
vi.mock("@/lib/hooks/reviews", () => ({
  usePrReviews: () => ({ data: [], refetch: vi.fn() }),
  useCancelRun: () => ({ mutate: vi.fn(), isPending: false }),
  usePrActiveRuns: () => ({ data: [] }),
  usePrRuns: () => ({ data: [] }),
  useDeleteRun: () => ({ mutate: vi.fn() }),
  smartDiffKey: (id: string) => ["reviews", id, "smart-diff"],
}));

// Child stubs: each exposes what the page hands it.
vi.mock("./_components/PrDetailHeader", () => ({
  PrDetailHeader: ({ onSetTab }: { onSetTab: (t: string) => void }) => (
    <div>
      <button onClick={() => onSetTab("overview")}>stub: Overview tab</button>
      <button onClick={() => onSetTab("diff")}>stub: Files tab</button>
    </div>
  ),
}));
vi.mock("./_components/OverviewTab", () => ({
  OverviewTab: ({
    changedPaths,
    onOpenInDiff,
  }: {
    changedPaths: string[];
    onOpenInDiff: (p: string, l: number | null) => void;
  }) => (
    <div>
      <span>stub changed: {changedPaths.join(",")}</span>
      <button onClick={() => onOpenInDiff("src/a.ts", 12)}>stub: open line</button>
      <button onClick={() => onOpenInDiff("src/b.ts", null)}>stub: open file</button>
    </div>
  ),
}));
vi.mock("./_components/FindingsTab", () => ({ FindingsTab: () => null }));
vi.mock("./_components/RunTraceDrawer", () => ({ default: () => null }));
vi.mock("./_components/DiffTab", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./_components/DiffTab")>()),
  DiffTab: ({ focus }: { focus: unknown }) => <span>stub focus: {JSON.stringify(focus)}</span>,
}));

import PRDetailPage from "./page";

beforeEach(() => {
  h.push.mockReset();
  h.replace.mockReset();
});
afterEach(cleanup);

function renderPage(query: string) {
  h.search = new URLSearchParams(query);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={{ shell }}>
        <PRDetailPage />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const paramsOf = (url: string) => new URLSearchParams(url.split("?")[1] ?? "");

describe("PR detail page — PR Brief navigation (R-53, R-59, R-77)", () => {
  it("passes the PR's changed paths to the Overview", () => {
    renderPage("tab=overview");
    expect(screen.getByText("stub changed: src/a.ts,src/b.ts")).toBeInTheDocument();
  });

  it("R-77 — a focus navigation pushes a new history entry to ?tab=diff&file=&line= without scrolling the page", () => {
    renderPage("tab=overview");
    fireEvent.click(screen.getByRole("button", { name: "stub: open line" }));
    expect(h.replace).not.toHaveBeenCalled();
    expect(h.push).toHaveBeenCalledTimes(1);
    const [url, opts] = h.push.mock.calls[0]!;
    expect(String(url).startsWith("/repos/r1/pulls/7?")).toBe(true);
    const sp = paramsOf(String(url));
    expect(sp.get("tab")).toBe("diff");
    expect(sp.get("file")).toBe("src/a.ts");
    expect(sp.get("line")).toBe("12");
    expect(opts).toEqual({ scroll: false });
  });

  it("R-55 — a reference without a line pushes file only", () => {
    renderPage("tab=overview");
    fireEvent.click(screen.getByRole("button", { name: "stub: open file" }));
    const sp = paramsOf(String(h.push.mock.calls[0]![0]));
    expect(sp.get("file")).toBe("src/b.ts");
    expect(sp.has("line")).toBe(false);
  });

  it("R-77, D-32 — a tab click replaces the entry and drops file and line", () => {
    renderPage("tab=diff&file=src/a.ts&line=12");
    fireEvent.click(screen.getByRole("button", { name: "stub: Overview tab" }));
    expect(h.push).not.toHaveBeenCalled();
    expect(h.replace).toHaveBeenCalledTimes(1);
    const sp = paramsOf(String(h.replace.mock.calls[0]![0]));
    expect(sp.get("tab")).toBe("overview");
    expect(sp.has("file")).toBe(false);
    expect(sp.has("line")).toBe(false);
  });

  it("R-59 — a reloaded ?tab=diff&file=&line= hands that focus to Files changed", () => {
    renderPage("tab=diff&file=src/a.ts&line=12");
    expect(screen.getByText('stub focus: {"path":"src/a.ts","line":12}')).toBeInTheDocument();
  });

  it("R-59 — Files changed without a file in the URL gets no focus", () => {
    renderPage("tab=diff");
    expect(screen.getByText("stub focus: null")).toBeInTheDocument();
  });
});
