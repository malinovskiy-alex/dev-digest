import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithPerfIntl, report } from "@/test/agent-performance-fixtures";
import { useAgentPerformance } from "@/lib/hooks/agent-performance";
import { bucketFor } from "@/lib/perf-range";
import { RangeControl, usePerfRange } from "./index";

// A router like Next's: `replace` commits the new address LATER than the
// click's own state update, so one render sees new state with the old address.
// `lastWins`: a newer navigation supersedes a pending one (transitions); else
// every navigation commits in order, intermediate addresses included.
const nav = vi.hoisted(() => ({
  search: new URLSearchParams(),
  listeners: new Set<() => void>(),
  replace: vi.fn(),
  lastWins: false,
  pending: null as ReturnType<typeof setTimeout> | null,
}));
vi.mock("next/navigation", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    usePathname: () => "/agent-performance",
    useSearchParams: () =>
      React.useSyncExternalStore(
        (cb) => {
          nav.listeners.add(cb);
          return () => nav.listeners.delete(cb);
        },
        () => nav.search,
      ),
    useRouter: () => ({
      replace: (url: string, opts: unknown) => {
        nav.replace(url, opts);
        if (nav.lastWins && nav.pending) clearTimeout(nav.pending);
        nav.pending = setTimeout(() => {
          nav.pending = null;
          nav.search = new URLSearchParams(url.split("?")[1] ?? "");
          nav.listeners.forEach((l) => l());
        }, 0);
      },
    }),
  };
});

const fetchMock = vi.fn();
beforeEach(() => {
  nav.search = new URLSearchParams();
  nav.replace.mockReset();
  nav.lastWins = false;
  nav.pending = null;
  fetchMock.mockReset();
  fetchMock.mockImplementation(() =>
    Promise.resolve({ ok: true, status: 200, statusText: "OK", json: () => Promise.resolve(report()) } as Response),
  );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function Harness() {
  const { choice, range, apply } = usePerfRange();
  useAgentPerformance(range, bucketFor(choice));
  return <RangeControl choice={choice} onApply={apply} />;
}

function renderHarness() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  renderWithPerfIntl(
    <QueryClientProvider client={qc}>
      <Harness />
    </QueryClientProvider>,
  );
}

/** Settle pending address commits and the renders they cause. */
const settle = () => act(() => new Promise((r) => setTimeout(r, 20)));

function toOf(url: string): number {
  return Date.parse(new URL(url).searchParams.get("to")!);
}

function hoursOf(url: string): number {
  const q = new URL(url).searchParams;
  return (Date.parse(q.get("to")!) - Date.parse(q.get("from")!)) / 3_600_000;
}

describe("usePerfRange", () => {
  it("issues exactly one new read per range change — no stray read from an in-between render (F-02, R-41)", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderWithPerfIntl(
      <QueryClientProvider client={qc}>
        <Harness />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(hoursOf(fetchMock.mock.calls[0]![0] as string)).toBe(720);

    fireEvent.click(screen.getByRole("button", { name: "1 day" }));
    expect(nav.replace).toHaveBeenCalledWith("/agent-performance?range=1d", { scroll: false });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    // Let any late render settle, then make sure nothing else was requested.
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = fetchMock.mock.calls[1]![0] as string;
    expect(hoursOf(second)).toBe(24);
    expect(new URL(second).searchParams.get("bucket")).toBe("hour");

    // Re-applying the preset that is already shown refreshes it once (R-34: a new apply moment).
    fireEvent.click(screen.getByRole("button", { name: "1 day" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("two fast applies before the address commits send exactly one new read (F-14)", async () => {
    nav.lastWins = true;
    renderHarness();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "1 day" }));
    fireEvent.click(screen.getByRole("button", { name: "30 days" }));
    await settle();
    // The last apply wins: 30 days re-applied now — one read, never a 1-day one.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(hoursOf(fetchMock.mock.calls[1]![0] as string)).toBe(720);
  });

  it("resolves every address it passes through at that choice's own apply time (F-14, R-34)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const T0 = new Date("2026-11-05T10:00:00.000Z");
    const T1 = new Date("2026-11-05T10:00:05.000Z");
    const T2 = new Date("2026-11-05T10:00:09.000Z");
    vi.setSystemTime(T0);
    renderHarness();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    vi.setSystemTime(T1);
    fireEvent.click(screen.getByRole("button", { name: "1 day" }));
    vi.setSystemTime(T2);
    fireEvent.click(screen.getByRole("button", { name: "30 days" }));
    await settle();

    // Distinct query keys only: TanStack may refetch a stale key that becomes active
    // again (staleTime 0) — that is the same read, not a stray one.
    const urls = [...new Set(fetchMock.mock.calls.map((c) => c[0] as string))];
    // Mount, the re-applied 30 days, and the intermediate 1-day address — each at its own moment.
    expect(urls).toHaveLength(3);
    for (const u of urls) {
      const expected = hoursOf(u) === 24 ? T1 : toOf(u) === T0.getTime() ? T0 : T2;
      expect(toOf(u)).toBe(expected.getTime());
    }
    expect(urls.filter((u) => hoursOf(u) === 24).map(toOf)).toEqual([T1.getTime()]);
  });
});
