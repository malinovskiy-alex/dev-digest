import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { BlastRadius, PrHistory } from "@devdigest/shared";
import blast from "../../../../../../../../messages/en/blast.json";
import { githubBlobUrl } from "@/lib/github-urls";

const h = vi.hoisted(() => ({
  blast: {} as { data?: unknown; isLoading: boolean; error: Error | null; refetch: () => void },
  history: {} as { data?: unknown; isLoading: boolean; error: Error | null; refetch: () => void },
  mutate: (() => {}) as (...args: unknown[]) => void,
  // What GET /repos/:id/index-state returns: `state` is the cached query data,
  // `fresh` is what a refetch reads.
  state: undefined as { updatedAt: string } | undefined,
  fresh: { updatedAt: "2026-10-01T00:00:00Z" } as { updatedAt: string } | undefined,
}));

// The real useBlastResync runs on top of the mocked repo-intel hooks below.
vi.mock("@/lib/hooks/blast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/hooks/blast")>()),
  useBlastRadius: () => h.blast,
  usePrHistory: () => h.history,
}));

vi.mock("@/lib/hooks/repo-intel", () => ({
  useRepoIntelStatus: () => ({ data: h.state, refetch: async () => ({ data: h.fresh }) }),
  useResyncRepoIntel: () => ({ mutate: h.mutate, isPending: false }),
}));

import { BlastRadiusCard } from "./BlastRadiusCard";

const BLAST: BlastRadius = {
  changed_symbols: [
    { name: "getContext", file: "src/ctx.ts", kind: "function" },
    { name: "slug", file: "src/util.ts", kind: "function" },
  ],
  downstream: [
    {
      symbol: "getContext",
      callers: [
        { name: "bRoutes", file: "src/b/routes.ts", line: 4, endpoints: ["GET /b"], crons: ["nightly"] },
        { name: "aRoutes", file: "src/a/routes.ts", line: 12, endpoints: ["GET /a"], crons: [] },
      ],
      endpoints_affected: ["GET /a", "GET /b"],
      crons_affected: ["nightly"],
    },
    {
      symbol: "slug",
      callers: [{ name: "runJobs", file: "src/jobs.ts", line: 3, endpoints: [], crons: [] }],
      endpoints_affected: [],
      crons_affected: [],
    },
  ],
  summary: "2 symbols changed · 3 callers · 2 endpoints · 1 cron",
  counts: { symbols: 2, callers: 3, endpoints: 2, crons: 1 },
  degraded: false,
  reason: null,
  index_status: "full",
  indexed_sha: "idx-sha",
};

const HISTORY: PrHistory = { history: [], candidates: 0, unchecked: 0, github_unavailable: false };

function setBlast(data: BlastRadius) {
  h.blast = { data, isLoading: false, error: null, refetch: vi.fn() };
}

type CardProps = Partial<{ repoFullName: string | null; headSha: string }>;

// One client per test, so a rerender keeps the same query cache.
let qc: QueryClient;

function cardTree(props: CardProps = {}) {
  return (
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ blast }}>
        <BlastRadiusCard
          prId="pr-1"
          repoId="repo-1"
          repoFullName={"repoFullName" in props ? (props.repoFullName ?? null) : "acme/api"}
          headSha={props.headSha ?? "head-sha"}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

function renderCard(props: CardProps = {}) {
  return render(cardTree(props));
}

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  setBlast(BLAST);
  h.history = { data: HISTORY, isLoading: false, error: null, refetch: vi.fn() };
  h.mutate = vi.fn();
  h.state = { updatedAt: "2026-10-01T00:00:00Z" };
  h.fresh = { updatedAt: "2026-10-01T00:00:00Z" };
});

afterEach(() => cleanup());

describe("BlastRadiusCard", () => {
  it("shows the stats, the first symbol expanded with GitHub caller links, and grouped targets", () => {
    renderCard();
    const card = screen.getByRole("region", { name: "Blast radius" });

    // (a) stats, zeros included
    expect(within(card).getByText("symbols").closest("li")).toHaveTextContent("2symbols");
    expect(within(card).getByText("callers").closest("li")).toHaveTextContent("3callers");
    expect(within(card).getByText("endpoints").closest("li")).toHaveTextContent("2endpoints");
    expect(within(card).getByText("cron/jobs").closest("li")).toHaveTextContent("1cron/jobs");

    // (b) first symbol open, links pinned to the indexed sha
    const first = screen.getByRole("button", { name: /getContext\(\)/ });
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(first).toHaveTextContent("2 callers");
    const link = screen.getByRole("link", { name: "Open src/b/routes.ts:4 on GitHub" });
    expect(link).toHaveAttribute("href", githubBlobUrl("acme/api", "idx-sha", "src/b/routes.ts", 4));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    // (d) endpoints and crons in separate labelled groups
    const endpoints = screen.getByRole("list", { name: "Endpoints" });
    expect(within(endpoints).getByText("GET /a")).toBeInTheDocument();
    expect(within(endpoints).queryByText("nightly")).not.toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Crons / jobs" })).getByText("nightly")).toBeInTheDocument();

    // (c) collapse / expand
    const second = screen.getByRole("button", { name: /slug\(\)/ });
    expect(second).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("src/jobs.ts:3")).toBeInTheDocument();
    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Open src/b/routes.ts:4 on GitHub" })).not.toBeInTheDocument();

    // no index badge on a full index
    expect(screen.queryByText("Index incomplete")).not.toBeInTheDocument();
  });

  it("falls back to the PR head sha, and renders no links without a repo name", () => {
    setBlast({ ...BLAST, indexed_sha: null });
    renderCard();
    expect(screen.getByRole("link", { name: "Open src/a/routes.ts:12 on GitHub" })).toHaveAttribute(
      "href",
      githubBlobUrl("acme/api", "head-sha", "src/a/routes.ts", 12),
    );
    cleanup();

    // (h)
    renderCard({ repoFullName: null });
    expect(screen.getByText("src/a/routes.ts:12")).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("says when nothing calls the changed symbols, and hides the view toggle", () => {
    setBlast({
      ...BLAST,
      downstream: [],
      counts: { symbols: 2, callers: 0, endpoints: 0, crons: 0 },
    });
    renderCard();
    expect(screen.getByText("2 changed symbol(s), no downstream callers found.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Blast radius view" })).not.toBeInTheDocument();
  });

  it("flags a degraded map with its reason, and Resync starts a resync", async () => {
    setBlast({ ...BLAST, downstream: [], degraded: true, reason: "no_data", index_status: "degraded" });
    renderCard();
    expect(screen.getByText("Index incomplete")).toBeInTheDocument();
    expect(screen.getByText("this repository has not been indexed yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resync" }));
    await waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: /Resyncing…/ })).toBeDisabled();
  });

  it("keeps polling until updatedAt moves past the freshly read baseline", async () => {
    setBlast({ ...BLAST, downstream: [], degraded: true, reason: "no_data", index_status: "degraded" });
    h.state = undefined; // index state not loaded yet when Resync is clicked
    h.fresh = { updatedAt: "2026-10-01T00:00:00Z" };
    const { rerender } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Resync" }));
    await waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1));

    // the first poll returns the pre-resync state: not done yet
    h.state = { updatedAt: "2026-10-01T00:00:00Z" };
    rerender(cardTree());
    expect(screen.getByRole("button", { name: /Resyncing…/ })).toBeDisabled();

    // the job wrote a new state row: done
    h.state = { updatedAt: "2026-10-01T00:05:00Z" };
    rerender(cardTree());
    await waitFor(() => expect(screen.getByRole("button", { name: "Resync" })).toBeEnabled());
  });

  it("flags a partial index the facade served as non-degraded", () => {
    setBlast({ ...BLAST, degraded: false, index_status: "partial" });
    renderCard();
    expect(screen.getByText("Index incomplete")).toBeInTheDocument();
    expect(screen.getByText("the index is partial — some files were skipped")).toBeInTheDocument();
  });

  it("toggles between the tree and the graph", () => {
    renderCard();
    const group = screen.getByRole("group", { name: "Blast radius view" });
    const tree = within(group).getByRole("button", { name: "tree" });
    const graph = within(group).getByRole("button", { name: "graph" });
    expect(tree).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(graph);
    expect(graph).toHaveAttribute("aria-pressed", "true");
    expect(tree).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("img", { name: /Blast radius graph/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /getContext\(\)/ })).not.toBeInTheDocument();

    fireEvent.click(tree);
    expect(screen.queryByRole("img", { name: /Blast radius graph/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /getContext\(\)/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("shows an error with a retry", () => {
    const refetch = vi.fn();
    h.blast = { data: undefined, isLoading: false, error: new Error("boom"), refetch };
    renderCard();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load the blast radius.");
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });
});
