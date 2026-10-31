import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ContextDoc, ContextDocList } from "@devdigest/shared";
import context from "../../../../../../../messages/en/context.json";
// RepoNotFound translates under `common`.
import common from "../../../../../../../messages/en/common.json";

// Cross-cutting chrome with its own providers; this suite is about the screen.
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const replace = vi.fn();
let search = new URLSearchParams();
let routeRepoId = "r1";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useParams: () => ({ repoId: routeRepoId }),
  useSearchParams: () => search,
}));

let repoNotFound = false;
vi.mock("@/lib/repo-context", () => ({
  useActiveRepo: () => ({
    repoId: "r1",
    repos: [{ id: "r1", full_name: "acme/payments-api" }],
    activeRepo: null,
    setRepoId: vi.fn(),
    reposLoaded: true,
  }),
  useRepoNotFound: () => repoNotFound,
}));

import { ProjectContextView } from "./ProjectContextView";

function doc(path: string, tokens: number, over: Partial<ContextDoc> = {}): ContextDoc {
  const slash = path.lastIndexOf("/");
  return {
    path,
    name: slash >= 0 ? path.slice(slash + 1) : path,
    folder: slash >= 0 ? path.slice(0, slash) : "",
    category: slash >= 0 ? path.slice(0, path.indexOf("/")) : "root",
    chars: tokens * 4,
    approx_tokens: tokens,
    truncated: false,
    used_by: 0,
    ...over,
  };
}

const LONG = "specs/feature-x/a-really-long-requirements-document-name-for-the-feature.md";
const LISTING: ContextDocList = {
  cloned: true,
  sha: "abc1234",
  listed_at: "2026-10-30T10:00:00.000Z",
  total: 4,
  capped: false,
  docs: [
    doc("README.md", 50),
    doc("docs/security-baseline.md", 1200, { used_by: 2 }),
    doc("docs/huge.md", 8000, { truncated: true }),
    doc(LONG, 100),
  ],
};

const SECURITY_MD = [
  "# Security baseline",
  "",
  "Secrets never live in source.",
  "",
  '<script>window.__ctxPwned = true</script>',
  '<img src=x onerror="window.__ctxPwned = true">',
  "",
  "[open me](javascript:window.__ctxPwned=true)",
].join("\n");

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status < 400,
    status,
    statusText: status < 400 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  } as Response);

type Handler = (url: string) => Promise<Response>;
function routes(list: Handler, content: Handler = () => json({ path: "docs/security-baseline.md", sha: "abc1234", content: SECURITY_MD, chars: SECURITY_MD.length })) {
  fetchMock.mockImplementation((url: string) =>
    url.includes("/context-docs/content") ? content(url) : list(url),
  );
}
const listCalls = () => fetchMock.mock.calls.filter((c) => !String(c[0]).includes("/content")).length;

beforeEach(() => {
  fetchMock.mockReset();
  replace.mockReset();
  search = new URLSearchParams();
  routeRepoId = "r1";
  repoNotFound = false;
  delete (window as unknown as { __ctxPwned?: boolean }).__ctxPwned;
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ context, common }}>
        <ProjectContextView />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("ProjectContextView", () => {
  it("lists the docs as a folder tree with category tags, a footer, a refresh, and no write controls", async () => {
    routes(() => json(LISTING));
    renderView();

    const tree = await screen.findByRole("list", { name: "Project documents" });
    // folders are toggleable and start open
    expect(within(tree).getByRole("button", { name: "Toggle folder docs" })).toHaveAttribute("aria-expanded", "true");
    expect(within(tree).getByRole("button", { name: "Toggle folder specs/feature-x" })).toBeInTheDocument();
    // a root doc carries the `root` category; a folder doc its first folder
    expect(within(tree).getByTitle("README.md")).toHaveTextContent("root");
    expect(within(tree).getByTitle("docs/security-baseline.md")).toHaveTextContent("docs");
    // long names are middle-truncated, the full path is in the tooltip (UX-03)
    const long = within(tree).getByTitle(LONG);
    expect(long).toHaveTextContent("…");
    expect(long).not.toHaveTextContent("a-really-long-requirements-document-name-for-the-feature.md");

    // collapsing a folder hides its docs
    fireEvent.click(within(tree).getByRole("button", { name: "Toggle folder docs" }));
    expect(within(tree).queryByTitle("docs/security-baseline.md")).not.toBeInTheDocument();

    // footer: N files · M tokens (R-66)
    expect(screen.getByText("Indexed: 4 files · 9,350 tokens total")).toBeInTheDocument();
    expect(screen.getByText(/^refreshed /)).toBeInTheDocument();
    expect(screen.getByText("Select a document to read it.")).toBeInTheDocument();

    // read-only: nothing to edit, create, upload or delete (R-05)
    for (const name of [/edit/i, /new/i, /upload/i, /delete/i, /save/i]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }

    // refresh re-reads the listing (R-06)
    const before = listCalls();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(listCalls()).toBe(before + 1));
    expect(String(fetchMock.mock.calls.at(-1)![0])).toMatch(/\/repos\/r1\/context-docs$/);

    // selecting puts the path in the URL
    fireEvent.click(within(tree).getByTitle("README.md"));
    expect(replace).toHaveBeenCalledWith("/repos/r1/context?path=README.md");
  });

  it("the selected doc shows its name, ≈ tokens, Used by N, and rendered markdown with HTML and javascript: inert (R-04, R-07, R-08, R-17)", async () => {
    search = new URLSearchParams({ path: "docs/security-baseline.md" });
    routes(() => json(LISTING));
    renderView();

    expect(await screen.findByRole("heading", { level: 2, name: "security-baseline.md" })).toBeInTheDocument();
    expect(screen.getByText("≈ 1,200 tokens")).toBeInTheDocument();
    expect(screen.getByText("Used by 2 agents")).toBeInTheDocument();
    const article = screen.getByRole("article");
    expect(await within(article).findByRole("heading", { name: "Security baseline" })).toBeInTheDocument();
    expect(within(article).getByText("Secrets never live in source.")).toBeInTheDocument();

    expect(article.querySelector("script")).toBeNull();
    expect(article.querySelector("img")).toBeNull();
    expect(within(article).getByText("open me")).toBeInTheDocument();
    for (const a of Array.from(article.querySelectorAll("a"))) {
      expect(a.getAttribute("href") ?? "").not.toMatch(/^\s*javascript:/i);
    }
    expect((window as unknown as { __ctxPwned?: boolean }).__ctxPwned).toBeUndefined();
    const url = String(fetchMock.mock.calls.find((c) => String(c[0]).includes("/content"))![0]);
    expect(url).toContain("/repos/r1/context-docs/content?path=docs%2Fsecurity-baseline.md");
  });

  it("a truncated doc is marked as such", async () => {
    search = new URLSearchParams({ path: "docs/huge.md" });
    routes(() => json(LISTING), () => json({ path: "docs/huge.md", sha: "abc1234", content: "x", chars: 1 }));
    renderView();
    expect(await screen.findByText("truncated to ≈ 8k tokens in a prompt")).toBeInTheDocument();
  });

  it("a doc gone from HEAD says so and offers to refresh the list (R-14)", async () => {
    search = new URLSearchParams({ path: "docs/gone.md" });
    routes(
      () => json(LISTING),
      () => json({ error: { code: "context_doc_not_found", message: "Document not found at the current HEAD" } }, 404),
    );
    renderView();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("File not found at the current HEAD — it may have been moved or deleted.");
    const before = listCalls();
    fireEvent.click(within(alert).getByRole("button", { name: "Refresh list" }));
    await waitFor(() => expect(listCalls()).toBe(before + 1));
  });

  it("over 1,000 docs: warns that the list is truncated", async () => {
    const docs = Array.from({ length: 1000 }, (_, i) => doc(`docs/d${String(i).padStart(4, "0")}.md`, 1));
    routes(() => json({ ...LISTING, total: 1001, capped: true, docs }));
    renderView();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "List truncated: showing the first 1,000 of 1,001 documents",
    );
  });

  it("a repo that has not been cloned yet says so (R-12)", async () => {
    routes(() => json({ cloned: false, sha: null, listed_at: LISTING.listed_at, total: 0, capped: false, docs: [] }));
    renderView();
    expect(await screen.findByText("Available after cloning")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Project documents" })).not.toBeInTheDocument();
  });

  it("a clone with no markdown says so (R-11)", async () => {
    routes(() => json({ ...LISTING, total: 0, docs: [] }));
    renderView();
    expect(await screen.findByText("No markdown documents found")).toBeInTheDocument();
  });

  it("while loading it shows skeletons (R-10)", () => {
    routes(() => new Promise<Response>(() => {}));
    renderView();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole("list", { name: "Project documents" })).not.toBeInTheDocument();
  });

  it("a failed listing shows an error with a Retry that recovers (R-13)", async () => {
    let fail = true;
    routes(() => (fail ? json({ error: { code: "x", message: "git exploded" } }, 500) : json(LISTING)));
    renderView();
    expect(await screen.findByText("Couldn’t load the project documents.")).toBeInTheDocument();
    expect(screen.getByText("git exploded")).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("list", { name: "Project documents" })).toBeInTheDocument();
  });

  it("an unknown repo shows the no-repo state (R-15)", () => {
    repoNotFound = true;
    routeRepoId = "nope";
    routes(() => json(LISTING));
    renderView();
    expect(screen.getByText("No repo selected")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Project Context" })).not.toBeInTheDocument();
  });
});
