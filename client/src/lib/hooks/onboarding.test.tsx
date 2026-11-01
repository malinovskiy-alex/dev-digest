/**
 * useTour / useGenerateTour — invalidate after a start, poll every 2,000 ms
 * while a generation runs, stop when it ends (plan step 31: AC-27, AC-28,
 * AC-29, D-39). `fetch` is mocked; React Query is real.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import React from "react";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { OnboardingTour } from "@devdigest/shared";
import { useGenerateTour, useTour } from "./onboarding";

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, statusText: "OK", json: () => Promise.resolve(body) } as Response);

const tourWith = (running: boolean) => ({ repo_id: "r1", generation: { running, failure: null } }) as unknown as OnboardingTour;

const gets = () => fetchMock.mock.calls.filter((c) => ((c[1] as RequestInit | undefined)?.method ?? "GET") === "GET").length;

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
  const W = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return W;
}

describe("onboarding hooks", () => {
  it("AC-27 — after useGenerateTour().mutate() the tour query is refetched", async () => {
    fetchMock.mockImplementation((_u: string, init?: RequestInit) =>
      init?.method === "POST" ? json({ running: true }, 202) : json(tourWith(false)),
    );
    const W = wrapper();
    const { result } = renderHook(() => ({ tour: useTour("r1"), gen: useGenerateTour("r1") }), { wrapper: W });
    await waitFor(() => expect(result.current.tour.data).toBeDefined());
    const before = gets();
    act(() => result.current.gen.mutate());
    await waitFor(() => expect(gets()).toBeGreaterThan(before));
    const post = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST")!;
    expect(String(post[0])).toMatch(/\/repos\/r1\/tour\/generate$/);
  });

  it("AC-28, AC-29, D-39 — polls every 2,000 ms while running, and stops once running is false", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    let running = true;
    fetchMock.mockImplementation(() => json(tourWith(running)));
    const W = wrapper();
    renderHook(() => useTour("r1"), { wrapper: W });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(gets()).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_999);
    });
    expect(gets()).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(gets()).toBe(2);

    running = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(gets()).toBe(3); // this poll sees running: false
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(gets()).toBe(3);
  });
});
