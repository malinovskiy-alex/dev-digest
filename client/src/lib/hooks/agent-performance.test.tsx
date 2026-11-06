import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import React from "react";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAgentPerformance, useAgentStats } from "./agent-performance";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() =>
    Promise.resolve({ ok: true, status: 200, statusText: "OK", json: () => Promise.resolve({}) } as Response),
  );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const RANGE = { from: new Date("2026-10-06T12:00:00.000Z"), to: new Date("2026-11-05T12:00:00.000Z") };

/** Every request the hooks made, as [method, url]. A missing method is fetch's default, GET. */
function requests(): [string, URL][] {
  return fetchMock.mock.calls.map(([url, init]) => [
    ((init as RequestInit | undefined)?.method ?? "GET").toUpperCase(),
    new URL(url as string),
  ]);
}

describe("agent-performance hooks", () => {
  it("read the dashboard and the stats with GET only, never a write (R-29, R-74, R-83)", async () => {
    renderHook(
      () => {
        useAgentPerformance(RANGE, "hour");
        useAgentStats("a 1", RANGE);
      },
      { wrapper },
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const reqs = requests();
    expect(reqs.every(([method]) => method === "GET")).toBe(true);
    for (const [, url] of reqs) {
      expect(url.searchParams.get("from")).toBe(RANGE.from.toISOString());
      expect(url.searchParams.get("to")).toBe(RANGE.to.toISOString());
      expect(url.searchParams.get("tz")).toBeTruthy();
    }
    const [dash, stats] = reqs.map(([, u]) => u);
    expect(dash!.pathname).toBe("/agents/performance");
    expect(dash!.searchParams.get("bucket")).toBe("hour");
    expect(stats!.pathname).toBe("/agents/a%201/stats");
    expect(stats!.searchParams.get("bucket")).toBe("day");
  });
});
