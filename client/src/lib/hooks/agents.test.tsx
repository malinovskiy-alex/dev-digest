import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import React from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDeleteAgent, useSetAgentSkills } from "./agents";
import { useSkill, useSkills } from "./skills";
import { useSkillsPullFrequency } from "./skill-stats";

const fetchMock = vi.fn();

function json(body: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve(body),
  } as Response);
}

let qc: QueryClient;
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

/** Every GET to `pathname`, counted from the stubbed fetch. */
function gets(pathname: string): number {
  return fetchMock.mock.calls.filter(([url, init]) => {
    const method = ((init as RequestInit | undefined)?.method ?? "GET").toUpperCase();
    return method === "GET" && new URL(url as string).pathname === pathname;
  }).length;
}

describe("useSetAgentSkills (F-16)", () => {
  it("re-reads the active skill list and the cards' pull frequency after an attach/detach", async () => {
    fetchMock.mockImplementation((url: string) => {
      const path = new URL(url).pathname;
      if (path === "/skills/pull-frequency") return json({ range: {}, skills: [] });
      return json([]);
    });

    const { result } = renderHook(
      () => ({ list: useSkills(), freq: useSkillsPullFrequency(), set: useSetAgentSkills() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
      expect(result.current.freq.isSuccess).toBe(true);
    });
    expect(gets("/skills")).toBe(1);
    expect(gets("/skills/pull-frequency")).toBe(1);

    await act(() =>
      result.current.set.mutateAsync({ agentId: "a1", skills: [{ skill_id: "s1", enabled: true }] }),
    );

    // `staleTime: Infinity` on the pull frequency: only an invalidation re-reads it.
    await waitFor(() => {
      expect(gets("/skills")).toBe(2);
      expect(gets("/skills/pull-frequency")).toBe(2);
    });
    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST");
    expect(new URL(post![0] as string).pathname).toBe("/agents/a1/skills");
  });
});

describe("useDeleteAgent (F-23)", () => {
  it("re-reads the skill list, one skill and the cards' pull frequency after a delete", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      if ((init?.method ?? "GET").toUpperCase() === "DELETE") return json({ ok: true });
      if (path === "/skills/pull-frequency") return json({ range: {}, skills: [] });
      if (path === "/skills/s1") return json({ id: "s1" });
      return json([]);
    });

    const { result } = renderHook(
      () => ({ list: useSkills(), one: useSkill("s1"), freq: useSkillsPullFrequency(), del: useDeleteAgent() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
      expect(result.current.one.isSuccess).toBe(true);
      expect(result.current.freq.isSuccess).toBe(true);
    });
    expect(gets("/skills")).toBe(1);
    expect(gets("/skills/s1")).toBe(1);
    expect(gets("/skills/pull-frequency")).toBe(1);

    await act(() => result.current.del.mutateAsync("a1"));

    await waitFor(() => {
      expect(gets("/skills")).toBe(2);
      expect(gets("/skills/s1")).toBe(2);
      expect(gets("/skills/pull-frequency")).toBe(2);
    });
    const del = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "DELETE");
    expect(new URL(del![0] as string).pathname).toBe("/agents/a1");
  });
});
