import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Skill, SkillImportPreview } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";
import { ImportSkillDrawer } from "./ImportSkillDrawer";

const PREVIEW: SkillImportPreview = {
  token: "b1946ac92492d2347c6235b4d2611184",
  name: "flake-patterns",
  description: "Flag sleeps, real clocks and network calls in unit tests.",
  type: "convention",
  body: "# Flake patterns\n\nA unit test that sleeps is a unit test that flakes.",
  source: "imported_file",
  entries: [
    { path: "SKILL.md", bytes: 1840, kind: "core", ignored: false },
    { path: "README.md", bytes: 320, kind: "doc", ignored: true },
    { path: "install.sh", bytes: 96, kind: "executable", ignored: true },
  ],
  warnings: ["install.sh is executable — listed only, never read or run."],
};

const IMPORTED: Skill = {
  id: "sk9",
  name: "flake-patterns",
  description: PREVIEW.description,
  type: "convention",
  source: "imported_file",
  body: PREVIEW.body,
  enabled: false,
  version: 1,
  agent_count: 0,
};

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status < 400,
    status,
    statusText: "OK",
    json: () => Promise.resolve(body),
  } as Response);
}

function route(url: string) {
  if (url.endsWith("/skills/import/preview")) return jsonResponse(PREVIEW);
  if (url.endsWith("/skills/import")) return jsonResponse(IMPORTED, 201);
  return jsonResponse([]);
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => route(String(url)));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderDrawer(onImported = vi.fn(), onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
        <ToastProvider>
          <ImportSkillDrawer onClose={onClose} onImported={onImported} />
        </ToastProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { onImported, onClose };
}

function pickArchive(bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04])) {
  const file = new File([bytes], "flake-patterns.zip", { type: "application/zip" });
  fireEvent.change(screen.getByLabelText("Choose a .md or .zip file"), { target: { files: [file] } });
  return file;
}

function bodyOf(call: unknown[] | undefined) {
  return JSON.parse(String((call?.[1] as RequestInit).body));
}

describe("ImportSkillDrawer", () => {
  it("lists the archive's executable entry as not processed", async () => {
    renderDrawer();
    pickArchive();

    const row = await screen.findByRole("row", { name: /install\.sh/ });
    expect(within(row).getByText("executable")).toBeInTheDocument();
    expect(within(row).getByText("not processed")).toBeInTheDocument();
    // The one entry that IS decompressed carries no such marker.
    const core = screen.getByRole("row", { name: /SKILL\.md/ });
    expect(within(core).queryByText("not processed")).not.toBeInTheDocument();
  });

  it("shows the extracted fields and every warning before anything is stored", async () => {
    renderDrawer();
    pickArchive();

    expect(await screen.findByDisplayValue("flake-patterns")).toBeInTheDocument();
    expect(screen.getByText("What was ignored")).toBeInTheDocument();
    expect(
      screen.getByText("install.sh is executable — listed only, never read or run."),
    ).toBeInTheDocument();
    // Preview parses only: the confirm endpoint has not been called.
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/skills/import"))).toBe(false);
  });

  it("confirms with the preview's token and the edited fields", async () => {
    const { onImported, onClose } = renderDrawer();
    pickArchive();

    const name = await screen.findByLabelText("Name");
    fireEvent.change(name, { target: { value: "flake-patterns-v2" } });
    fireEvent.click(screen.getByText("Import skill"));

    await waitFor(() => {
      const confirm = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/skills/import"));
      expect(confirm).toBeDefined();
      const sent = bodyOf(confirm);
      expect(sent.token).toBe(PREVIEW.token);
      expect(sent.name).toBe("flake-patterns-v2");
      expect(sent.kind).toBe("archive");
      expect(sent.filename).toBe("flake-patterns.zip");
    });

    await waitFor(() => expect(onImported).toHaveBeenCalledWith(IMPORTED));
    expect(onClose).toHaveBeenCalled();
  });

  it("refuses a file over the 2 MB cap before it uploads anything", async () => {
    renderDrawer();
    const big = new File([new Uint8Array(1)], "huge.zip", { type: "application/zip" });
    Object.defineProperty(big, "size", { value: 3 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText("Choose a .md or .zip file"), { target: { files: [big] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("That file is over the 2 MB limit.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps an API error code to its own copy", async () => {
    fetchMock.mockImplementation((url: string) =>
      String(url).endsWith("/skills/import/preview")
        ? jsonResponse({ error: { code: "no_skill_core", message: "no core" } }, 422)
        : jsonResponse([]),
    );
    renderDrawer();
    pickArchive();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No markdown file in that archive",
    );
  });
});
