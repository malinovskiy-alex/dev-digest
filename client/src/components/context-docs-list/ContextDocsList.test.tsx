import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ContextDoc } from "@devdigest/shared";
import context from "../../../messages/en/context.json";
import { buildDocRows, toEntries, type DocRow } from "@/lib/context-docs";
import { ContextDocsList } from "./ContextDocsList";

function doc(path: string, tokens: number, over: Partial<ContextDoc> = {}): ContextDoc {
  const slash = path.lastIndexOf("/");
  return {
    path,
    name: path.slice(slash + 1),
    folder: slash >= 0 ? path.slice(0, slash) : "",
    category: slash >= 0 ? path.slice(0, path.indexOf("/")) : "root",
    chars: tokens * 4,
    approx_tokens: tokens,
    truncated: false,
    used_by: 0,
    ...over,
  };
}

// Two README.md in different folders: only a path-bearing name tells them apart (R-33).
const DOCS: ContextDoc[] = [
  doc("docs/README.md", 120),
  doc("specs/README.md", 80),
  doc("specs/huge.md", 8000, { truncated: true }),
  doc("docs/security.md", 300),
];

const fetchMock = vi.fn();
const onCommit = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  onCommit.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderList(rows: DocRow[], busy = false) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ context }}>
        <ContextDocsList repoId="r1" rows={rows} busy={busy} onCommit={onCommit} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

/** What the parent would PUT for the rows passed to the last onCommit. */
function committedEntries() {
  expect(onCommit).toHaveBeenCalledTimes(1);
  return toEntries(onCommit.mock.calls[0]![0] as DocRow[]);
}

const box = (path: string) => screen.getByRole("checkbox", { name: `Attach ${path}` });

describe("ContextDocsList", () => {
  it("addresses rows by path, shows weight/tag/truncation, and checking appends to the stored block", () => {
    renderList(buildDocRows(DOCS, [{ path: "specs/README.md", order: 0, enabled: true }]));

    expect(box("specs/README.md")).toHaveAttribute("aria-checked", "true");
    expect(box("docs/README.md")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "Preview docs/README.md" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Preview specs/README.md" })).toBeEnabled();
    // per-row weight and the truncation mark (R-26, R-67)
    expect(screen.getByText("≈ 8,000 tok")).toBeInTheDocument();
    expect(screen.getByText("will be truncated to ≈ 8k tokens")).toBeInTheDocument();

    fireEvent.click(box("docs/security.md"));
    expect(committedEntries()).toEqual([
      { path: "specs/README.md", enabled: true },
      { path: "docs/security.md", enabled: true },
    ]);
  });

  it("unchecking a stored row parks it in place (R-22)", () => {
    renderList(
      buildDocRows(DOCS, [
        { path: "docs/security.md", order: 0, enabled: true },
        { path: "specs/README.md", order: 1, enabled: true },
      ]),
    );
    fireEvent.click(box("docs/security.md"));
    expect(committedEntries()).toEqual([
      { path: "docs/security.md", enabled: false },
      { path: "specs/README.md", enabled: true },
    ]);
  });

  it("the filter narrows the view, and a keyboard move inside it still writes the FULL order (R-25)", () => {
    renderList(
      buildDocRows(DOCS, [
        { path: "specs/README.md", order: 0, enabled: true },
        { path: "docs/README.md", order: 1, enabled: true },
        { path: "specs/huge.md", order: 2, enabled: true },
      ]),
    );
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter documents by path" }), {
      target: { value: "SPECS" },
    });
    expect(screen.queryByRole("checkbox", { name: "Attach docs/README.md" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    // specs/huge.md is visually right under specs/README.md, but in the full list
    // docs/README.md sits between them: moving up swaps with docs/README.md.
    fireEvent.keyDown(screen.getByRole("button", { name: "Reorder specs/huge.md (↑ / ↓)" }), { key: "ArrowUp" });
    expect(committedEntries()).toEqual([
      { path: "specs/README.md", enabled: true },
      { path: "specs/huge.md", enabled: true },
      { path: "docs/README.md", enabled: true },
    ]);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nothing-like-this" } });
    expect(screen.getByText("No documents match “nothing-like-this”.")).toBeInTheDocument();
  });

  it("an unchecked row cannot be reordered", () => {
    renderList(buildDocRows(DOCS, [{ path: "docs/README.md", order: 0, enabled: false }]));
    expect(screen.getByRole("button", { name: "Check docs/README.md to reorder it" })).toBeDisabled();
  });

  it("a missing file is flagged, cannot be previewed, and unchecking detaches it (R-32)", () => {
    renderList(buildDocRows(DOCS, [{ path: "docs/gone.md", order: 0, enabled: true }]));
    const row = box("docs/gone.md").closest("li")!;
    expect(within(row).getByText("file not found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview docs/gone.md" })).toBeDisabled();
    fireEvent.click(box("docs/gone.md"));
    expect(committedEntries()).toEqual([]);
  });

  it("an inherited row says which skill it comes from and has no checkbox (R-69)", () => {
    renderList(buildDocRows(DOCS, [], [{ path: "docs/security.md", skill_id: "s1", skill_name: "Security" }]));
    expect(screen.getByText("via Security")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Attach docs/security.md" })).not.toBeInTheDocument();
  });

  it("while busy, a click writes nothing", () => {
    renderList(buildDocRows(DOCS, []), true);
    fireEvent.click(box("docs/security.md"));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("while a save is pending the reorder handle keeps focus and ↑/↓ is ignored (F-09)", () => {
    const rows = buildDocRows(DOCS, [
      { path: "docs/README.md", order: 0, enabled: true },
      { path: "specs/README.md", order: 1, enabled: true },
    ]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ui = (busy: boolean) => (
      <QueryClientProvider client={qc}>
        <NextIntlClientProvider locale="en" messages={{ context }}>
          <ContextDocsList repoId="r1" rows={rows} busy={busy} onCommit={onCommit} />
        </NextIntlClientProvider>
      </QueryClientProvider>
    );
    const view = render(ui(false));
    const handle = () => screen.getByRole("button", { name: "Reorder specs/README.md (↑ / ↓)" });
    handle().focus();
    fireEvent.keyDown(handle(), { key: "ArrowUp" });
    expect(onCommit).toHaveBeenCalledTimes(1);

    // the parent's save is now in flight
    view.rerender(ui(true));
    expect(handle()).toBeEnabled();
    expect(handle()).toHaveAttribute("aria-disabled", "true");
    expect(handle()).toHaveFocus();
    fireEvent.keyDown(handle(), { key: "ArrowUp" });
    fireEvent.keyDown(handle(), { key: "ArrowDown" });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(handle()).toHaveFocus();
  });

  it("Preview opens a dialog with the rendered document, raw HTML and javascript: links inert (R-29)", async () => {
    fetchMock.mockImplementation((url: string) => {
      expect(url).toContain("/repos/r1/context-docs/content?path=docs%2Fsecurity.md");
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () =>
          Promise.resolve({
            path: "docs/security.md",
            sha: "abc",
            content: '# Security baseline\n\n<script>window.__pwned = true</script>\n\n[click](javascript:alert(1))',
            chars: 10,
          }),
      } as Response);
    });
    renderList(buildDocRows(DOCS, []));
    fireEvent.click(screen.getByRole("button", { name: "Preview docs/security.md" }));

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByRole("heading", { name: "Security baseline" })).toBeInTheDocument();
    expect(dialog.querySelector("script")).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
    // the link text survives, its javascript: target does not
    expect(within(dialog).getByText("click")).toBeInTheDocument();
    for (const a of Array.from(dialog.querySelectorAll("a"))) {
      expect(a.getAttribute("href") ?? "").not.toMatch(/^\s*javascript:/i);
    }

    // the Modal's own ✕ and the footer button are both "Close"; the footer one is last
    const closes = within(dialog).getAllByRole("button", { name: "Close" });
    fireEvent.click(closes[closes.length - 1]!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
