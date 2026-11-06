import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import React from "react";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSkillStats, useSkillsPullFrequency } from "./skill-stats";
import { useSkill, useUpdateSkill } from "./skills";

const fetchMock = vi.fn();

function json(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve({
    ok: status < 400,
    status,
    statusText: status < 400 ? "OK" : "Not Found",
    json: () => Promise.resolve(body),
  } as Response);
}

let qc: QueryClient;
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  // The hook's own `retry` must decide — so no client-wide `retry: false` here.
  qc = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

/** Every request, as [method, url]. A missing method is fetch's default, GET. */
function requests(): [string, URL][] {
  return fetchMock.mock.calls.map(([url, init]) => [
    ((init as RequestInit | undefined)?.method ?? "GET").toUpperCase(),
    new URL(url as string),
  ]);
}

const RANGE = { from: new Date("2026-10-06T12:00:00.000Z"), to: new Date("2026-11-05T12:00:00.000Z") };
const HOUR = 3_600_000;

describe("skill-stats hooks (L08 skill-stats)", () => {
  it("reads a skill's stats with one GET per range; a new range is a new request (L4, R-30, R-52)", async () => {
    fetchMock.mockImplementation(() => json({}));
    const { rerender } = renderHook(({ range }) => useSkillStats("s 1", range), {
      wrapper,
      initialProps: { range: RANGE },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [[method, url]] = requests() as [[string, URL]];
    expect(method).toBe("GET");
    expect(url.pathname).toBe("/skills/s%201/stats");
    expect(url.searchParams.get("from")).toBe(RANGE.from.toISOString());
    expect(url.searchParams.get("to")).toBe(RANGE.to.toISOString());
    expect(url.searchParams.get("tz")).toBeTruthy();

    const next = { from: new Date(RANGE.to.getTime() - 24 * HOUR), to: RANGE.to };
    rerender({ range: next });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(requests()[1]![1].searchParams.get("from")).toBe(next.from.toISOString());
    expect(requests().every(([m]) => m === "GET")).toBe(true);
  });

  it("does not retry a 404 and makes the skill query re-read (L5, R-58, D-15)", async () => {
    fetchMock.mockImplementation(() => json({ error: { code: "not_found", message: "Skill not found" } }, 404));
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useSkillStats("s1", RANGE), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["skill", "s1"] });
  });

  it("reads every card's pull frequency in ONE GET over the 720 h ending at mount, as a map by skill (L4, R-73, R-74)", async () => {
    fetchMock.mockImplementation(() =>
      json({
        range: { ...RANGE, tz: "UTC", previous: RANGE },
        skills: [
          { skill_id: "s1", pull_frequency: { prs_with_skill: 1, prs_reviewed: 2, rate: 0.5 } },
          { skill_id: "s2", pull_frequency: { prs_with_skill: 0, prs_reviewed: 0, rate: null } },
        ],
      }),
    );
    const before = Date.now();
    // The page calls the hook once and hands every card its slice (SkillsListView.test.tsx counts the cards).
    const { result, rerender } = renderHook(() => useSkillsPullFrequency(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    rerender(); // a re-render keeps the mount-time window: no second read

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [[method, url]] = requests() as [[string, URL]];
    expect(method).toBe("GET");
    expect(url.pathname).toBe("/skills/pull-frequency");
    const from = Date.parse(url.searchParams.get("from")!);
    const to = Date.parse(url.searchParams.get("to")!);
    expect(to - from).toBe(720 * HOUR);
    expect(to).toBeGreaterThanOrEqual(before);
    expect(result.current.data!.get("s1")).toEqual({ prs_with_skill: 1, prs_reviewed: 2, rate: 0.5 });
    expect(result.current.data!.get("s2")!.rate).toBeNull();
  });

  it("refreshes an open Stats tab and the cards when a skill is written (F-06)", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? json({ id: "s1", enabled: false })
        : new URL(url).pathname === "/skills/pull-frequency"
          ? json({ range: {}, skills: [] })
          : json({}),
    );
    const { result } = renderHook(
      () => ({ stats: useSkillStats("s1", RANGE), pf: useSkillsPullFrequency(), update: useUpdateSkill() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.stats.isSuccess && result.current.pf.isSuccess).toBe(true));
    const reads = (path: string) => requests().filter(([m, u]) => m === "GET" && u.pathname === path).length;
    expect(reads("/skills/s1/stats")).toBe(1);
    expect(reads("/skills/pull-frequency")).toBe(1);

    // The kill-switch: the same mutation the cards' toggle uses.
    result.current.update.mutate({ id: "s1", patch: { enabled: false } });
    await waitFor(() => expect(reads("/skills/s1/stats")).toBe(2));
    await waitFor(() => expect(reads("/skills/pull-frequency")).toBe(2));
  });

  it("shows a deleted skill's not-found at once: the skill read does not retry a 404 (F-08, R-58)", async () => {
    fetchMock.mockImplementation(() => json({ error: { code: "not_found", message: "Skill not found" } }, 404));
    // This client retries 3 times by default — the hook's own `retry` must stop it.
    const { result } = renderHook(() => useSkill("s1"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
