import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ContextDoc, ContextDocList, Skill, SkillContextDocs } from "@devdigest/shared";
import skills from "../../../../../../../../messages/en/skills.json";
// The shared list translates under `context`, RepoNotFound under `common`.
import context from "../../../../../../../../messages/en/context.json";
import common from "../../../../../../../../messages/en/common.json";
import { ToastProvider } from "@/lib/toast";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/repo-context", () => ({
  useActiveRepo: () => ({ repoId: "r1", repos: [], activeRepo: null, setRepoId: vi.fn(), reposLoaded: true }),
}));

import { ContextTab } from "./ContextTab";

const SKILL: Skill = {
  id: "sk1",
  name: "security-baseline",
  description: "d",
  type: "rubric",
  source: "manual",
  body: "# rules",
  enabled: true,
  version: 4,
  agent_count: 2,
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
    used_by: 0,
  };
}

const LISTING: ContextDocList = {
  cloned: true,
  sha: "abc1234",
  listed_at: "2026-10-30T10:00:00.000Z",
  total: 3,
  capped: false,
  docs: [doc("docs/a.md", 100), doc("docs/b.md", 200), doc("specs/c.md", 400)],
};

// stored order is c then a — NOT alphabetical; b is parked between them
const LINKS: SkillContextDocs = {
  attached: [
    { path: "specs/c.md", order: 0, enabled: true },
    { path: "docs/b.md", order: 1, enabled: false },
    { path: "docs/a.md", order: 2, enabled: true },
  ],
};

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    statusText: status < 400 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  } as Response);

function routes(put: (body: { docs: { path: string; enabled: boolean }[] }) => Promise<Response>, links = LINKS) {
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === "PUT") return put(JSON.parse(String(init.body)));
    if (url.endsWith("/repos/r1/context-docs")) return json(LISTING);
    if (url.endsWith("/skills/sk1/context-docs")) return json(links);
    throw new Error(`unexpected fetch ${url}`);
  });
}

beforeEach(() => {
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
      <NextIntlClientProvider locale="en" messages={{ skills, context, common }}>
        <ToastProvider>
          <ContextTab skill={SKILL} />
        </ToastProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

const box = (path: string) => screen.getByRole("checkbox", { name: `Attach ${path}` });
/** The "Serializes as" preview, found by its own text: it always starts with the section heading. */
const serialized = () => {
  expect(screen.getByText("Serializes as")).toBeInTheDocument();
  return screen.getByText(/^## Project context/);
};

describe("Skill editor — Context tab", () => {
  it("shows N attached, the inheritance note, the total and the exact Serializes-as text in saved order", async () => {
    routes(() => json(LINKS));
    renderTab();

    expect(await screen.findByText("2 attached")).toBeInTheDocument();
    expect(
      screen.getByText("Every agent that has this skill active gets these documents too, after its own."),
    ).toBeInTheDocument();
    expect(screen.getByText("≈ 500 tokens in the prompt")).toBeInTheDocument();
    expect(serialized().textContent).toBe("## Project context\n- specs/c.md\n- docs/a.md");
  });

  it("a save persists the new list, and Serializes-as follows it", async () => {
    const puts: unknown[] = [];
    routes((body) => {
      puts.push(body);
      return json({ attached: body.docs.map((d, order) => ({ ...d, order })) });
    });
    renderTab();
    await screen.findByText("2 attached");

    fireEvent.click(box("docs/b.md")); // un-park b in place
    expect(await screen.findByText("Context documents updated")).toBeInTheDocument();
    expect(puts).toEqual([
      {
        docs: [
          { path: "specs/c.md", enabled: true },
          { path: "docs/b.md", enabled: true },
          { path: "docs/a.md", enabled: true },
        ],
      },
    ]);
    const put = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "PUT")!;
    expect(String(put[0])).toMatch(/\/skills\/sk1\/context-docs$/);
    expect(serialized().textContent).toBe("## Project context\n- specs/c.md\n- docs/b.md\n- docs/a.md");
    expect(screen.getByText("3 attached")).toBeInTheDocument();
  });

  it("a failed save rolls back and says why (R-40)", async () => {
    routes(() => json({ error: { code: "x", message: "write failed" } }, 500));
    renderTab();
    await screen.findByText("2 attached");

    fireEvent.click(box("specs/c.md"));
    expect(await screen.findByText("Couldn’t save the documents: write failed")).toBeInTheDocument();
    await waitFor(() => expect(box("specs/c.md")).toHaveAttribute("aria-checked", "true"));
    expect(screen.getByText("2 attached")).toBeInTheDocument();
    expect(serialized().textContent).toBe("## Project context\n- specs/c.md\n- docs/a.md");
  });

  it("a checked path missing from the active repo is in neither Serializes-as nor the count (F-22)", async () => {
    routes(() => json(LINKS), {
      attached: [
        { path: "specs/c.md", order: 0, enabled: true },
        { path: "docs/gone.md", order: 1, enabled: true },
        { path: "docs/a.md", order: 2, enabled: true },
      ],
    });
    renderTab();
    expect(await screen.findByText("2 attached")).toBeInTheDocument();
    expect(box("docs/gone.md")).toHaveAttribute("aria-checked", "true"); // the row is still shown, checked
    expect(serialized().textContent).toBe("## Project context\n- specs/c.md\n- docs/a.md");
  });

  it("with nothing checked it says the skill adds no project context", async () => {
    routes(() => json(LINKS), { attached: [{ path: "docs/a.md", order: 0, enabled: false }] });
    renderTab();
    expect(await screen.findByText("Nothing attached — this skill adds no project context.")).toBeInTheDocument();
    expect(screen.getByText("0 attached")).toBeInTheDocument();
  });
});
