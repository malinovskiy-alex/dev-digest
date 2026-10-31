import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Agent, AgentContextDocs, ContextDoc, ContextDocList } from "@devdigest/shared";
import agents from "../../../../../../../../messages/en/agents.json";
// The shared list translates under `context`, and RepoNotFound under `common`:
// without them next-intl renders raw keys and the suite stays green over it.
import context from "../../../../../../../../messages/en/context.json";
import common from "../../../../../../../../messages/en/common.json";
import { ToastProvider } from "@/lib/toast";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

let activeRepoId: string | null = "r1";
vi.mock("@/lib/repo-context", () => ({
  useActiveRepo: () => ({ repoId: activeRepoId, repos: [], activeRepo: null, setRepoId: vi.fn(), reposLoaded: true }),
}));

import { ContextTab } from "./ContextTab";

const AGENT: Agent = {
  id: "ag1",
  name: "General Reviewer",
  description: "",
  provider: "openrouter",
  model: "m",
  system_prompt: "s",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 3,
  skill_count: 1,
};

function doc(path: string, tokens: number): ContextDoc {
  const slash = path.lastIndexOf("/");
  return {
    path,
    name: path.slice(slash + 1),
    folder: path.slice(0, slash),
    category: path.slice(0, path.indexOf("/")),
    chars: tokens * 4,
    approx_tokens: tokens,
    truncated: false,
    used_by: 1,
  };
}

const LISTING: ContextDocList = {
  cloned: true,
  sha: "abc1234",
  listed_at: "2026-10-30T10:00:00.000Z",
  total: 4,
  capped: false,
  docs: [doc("docs/a.md", 100), doc("docs/b.md", 200), doc("specs/c.md", 400), doc("specs/d.md", 800)],
};

// a.md checked, b.md parked; c.md comes through a skill AND is not attached.
// a.md is ALSO inherited, so it must be counted once in the total.
const LINKS: AgentContextDocs = {
  attached: [
    { path: "docs/a.md", order: 0, enabled: true },
    { path: "docs/b.md", order: 1, enabled: false },
  ],
  inherited: [
    { path: "specs/c.md", skill_id: "s1", skill_name: "Security" },
    { path: "docs/a.md", skill_id: "s1", skill_name: "Security" },
  ],
};

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    statusText: status < 400 ? "OK" : "Internal Server Error",
    json: () => Promise.resolve(body),
  } as Response);

/** Default routes; `put` decides how the save answers. */
function routes(put: (body: unknown) => Promise<Response>) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === "PUT") return put(JSON.parse(String(init.body)));
    if (url.endsWith("/repos/r1/context-docs")) return json(LISTING);
    if (url.endsWith("/agents/ag1/context-docs")) return json(LINKS);
    throw new Error(`unexpected fetch ${url}`);
  });
}

beforeEach(() => {
  activeRepoId = "r1";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ agents, context, common }}>
        <ToastProvider>
          <ContextTab agent={AGENT} />
        </ToastProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const box = (path: string) => screen.getByRole("checkbox", { name: `Attach ${path}` });

describe("Agent editor — Context tab", () => {
  it("shows the ordered list, X of Y from the full array, the inherited row and a deduped total", async () => {
    routes(() => json(LINKS));
    renderTab();

    expect(await screen.findByText("1 of 4 attached")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Project context" })).toBeInTheDocument();
    // a (100) + c via skill (400); parked b and plain d are not in the prompt; a once.
    expect(screen.getByText("≈ 500 tokens in the prompt")).toBeInTheDocument();
    expect(screen.getAllByText("via Security")).toHaveLength(2);
    expect(screen.queryByRole("checkbox", { name: "Attach specs/c.md" })).not.toBeInTheDocument();
    // the untrusted note and the order hint (R-24, R-28)
    expect(screen.getByText(/sent as untrusted data inside ## Project context/)).toBeInTheDocument();
    expect(screen.getByText(/in this order, under ## Project context/)).toBeInTheDocument();

    // stored rows first, in stored order
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("a.md");
    expect(items[1]).toHaveTextContent("b.md");

    // a filter narrows the view; the counter and total do not move (counted from the full array)
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "specs/d" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("1 of 4 attached")).toBeInTheDocument();
    expect(screen.getByText("≈ 500 tokens in the prompt")).toBeInTheDocument();
  });

  it("checking a doc PUTs the whole ordered list and confirms", async () => {
    const puts: unknown[] = [];
    routes((body) => {
      puts.push(body);
      return json({ ...LINKS, attached: [...LINKS.attached, { path: "specs/d.md", order: 2, enabled: true }] });
    });
    renderTab();
    await screen.findByText("1 of 4 attached");

    fireEvent.click(box("specs/d.md"));
    expect(await screen.findByText("Context documents updated")).toBeInTheDocument();
    expect(puts).toEqual([
      {
        docs: [
          { path: "docs/a.md", enabled: true },
          { path: "docs/b.md", enabled: false },
          { path: "specs/d.md", enabled: true },
        ],
      },
    ]);
    const put = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "PUT")!;
    expect(String(put[0])).toMatch(/\/agents\/ag1\/context-docs$/);
    expect(await screen.findByText("2 of 4 attached")).toBeInTheDocument();
  });

  it("a rejected save rolls the rows back and says why (R-30)", async () => {
    let reject: (() => void) | undefined;
    routes(
      () =>
        new Promise<Response>((resolve) => {
          reject = () =>
            resolve({
              ok: false,
              status: 500,
              statusText: "Internal Server Error",
              json: () => Promise.resolve({ error: { code: "boom", message: "database is down" } }),
            } as Response);
        }),
    );
    renderTab();
    await screen.findByText("1 of 4 attached");

    fireEvent.click(box("specs/d.md"));
    // optimistic: the row is checked and counted while the write is in flight
    expect(box("specs/d.md")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("2 of 4 attached")).toBeInTheDocument();

    await waitFor(() => expect(reject).toBeTypeOf("function")); // the PUT is in flight
    reject!();
    expect(await screen.findByText("Couldn’t save the documents: database is down")).toBeInTheDocument();
    await waitFor(() => expect(box("specs/d.md")).toHaveAttribute("aria-checked", "false"));
    expect(screen.getByText("1 of 4 attached")).toBeInTheDocument();
  });

  it("with no active repo it shows the no-repo state instead of a list", () => {
    activeRepoId = null;
    routes(() => json(LINKS));
    renderTab();
    expect(screen.getByText("No repo selected")).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
});
