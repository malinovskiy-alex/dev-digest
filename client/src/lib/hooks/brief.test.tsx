/**
 * usePrBrief / useGenerateBrief — plan step 25b (R-69, R-70, D-35; F-10).
 * `fetch` is mocked; React Query is real. Expected values come from the
 * requirements and the plan's decisions: poll every 2,000 ms while the read
 * says `generating`, never otherwise; a started generation shows as
 * generating at once; a read that keeps failing stops the loop.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import React from "react";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PrBriefView } from "@devdigest/shared";
import { useGenerateBrief, usePrBrief } from "./brief";

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    statusText: status < 400 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  } as Response);

const view = (o: Partial<PrBriefView> = {}): PrBriefView => ({
  brief: null,
  stale: false,
  current_head_sha: "abc1234def",
  generating: false,
  last_failure: { code: "timeout", message: "timed out", at: "2026-11-01T10:00:00.000Z" },
  key_available: true,
  feature_model: { provider: "openai", model: "gpt-4.1" },
  ...o,
});

const method = (c: unknown[]) => (c[1] as RequestInit | undefined)?.method ?? "GET";
const gets = () => fetchMock.mock.calls.filter((c) => method(c) === "GET").length;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const W = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return W;
}

const tick = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe("PR Brief hooks", () => {
  it("R-70, D-35 — polls GET /pulls/:id/brief every 2,000 ms while generating, and stops once it is not", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    let generating = true;
    fetchMock.mockImplementation(() => json(view({ generating })));
    renderHook(() => usePrBrief("pr-1"), { wrapper: wrapper() });

    await tick(0);
    expect(gets()).toBe(1);
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/pulls\/pr-1\/brief$/);

    await tick(1_999);
    expect(gets()).toBe(1);
    await tick(1);
    expect(gets()).toBe(2);

    generating = false;
    await tick(2_000);
    expect(gets()).toBe(3); // this read sees generating: false
    await tick(20_000);
    expect(gets()).toBe(3);
  });

  it("R-03, R-47 — a read that is not generating never polls and never posts", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    fetchMock.mockImplementation(() => json(view()));
    renderHook(() => usePrBrief("pr-1"), { wrapper: wrapper() });
    await tick(0);
    await tick(30_000);
    expect(gets()).toBe(1);
    expect(fetchMock.mock.calls.filter((c) => method(c) === "POST")).toHaveLength(0);
  });

  it("F-10 — polling stops when the read starts failing, even though the cached data still says generating", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    let fail = false;
    fetchMock.mockImplementation(() =>
      fail ? json({ error: { code: "internal", message: "boom" } }, 500) : json(view({ generating: true })),
    );
    // Read every field inside the render, so the observer re-renders on each of them.
    const { result } = renderHook(
      () => {
        const q = usePrBrief("pr-1");
        return { generating: q.data?.generating, isError: q.isError };
      },
      { wrapper: wrapper() },
    );
    await tick(0);
    expect(result.current.generating).toBe(true);

    fail = true;
    // the next poll fails, then the hook's single retry fails too
    await tick(2_000);
    await tick(5_000);
    expect(result.current.isError).toBe(true);
    expect(result.current.generating).toBe(true); // stale data still says generating
    const settled = gets();
    await tick(30_000);
    expect(gets()).toBe(settled);
  });

  it("R-69, R-74 — Generate marks the cached view generating and clears the last failure at once, then re-reads", async () => {
    let posted = false;
    fetchMock.mockImplementation((_u: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posted = true;
        return json({ generating: true }, 202);
      }
      // Before the POST: the stored state. After it: the re-read never answers,
      // so whatever the cache shows is the hook's own optimistic write.
      return posted ? new Promise<Response>(() => {}) : json(view());
    });
    const { result } = renderHook(() => ({ q: usePrBrief("pr-1"), g: useGenerateBrief("pr-1") }), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.q.data).toBeDefined());
    expect(result.current.q.data!.generating).toBe(false);
    expect(result.current.q.data!.last_failure).not.toBeNull();
    const before = gets();

    act(() => result.current.g.mutate());
    await waitFor(() => expect(result.current.q.data!.generating).toBe(true));
    expect(result.current.q.data!.last_failure).toBeNull();
    const post = fetchMock.mock.calls.find((c) => method(c) === "POST")!;
    expect(String(post[0])).toMatch(/\/pulls\/pr-1\/brief\/generate$/);
    expect(fetchMock.mock.calls.filter((c) => method(c) === "POST")).toHaveLength(1);
    await waitFor(() => expect(gets()).toBeGreaterThan(before));
  });
});
