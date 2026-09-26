import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ConventionsView as ConventionsViewData } from "@devdigest/shared";
import conventions from "../../../../../../../messages/en/conventions.json";
import skills from "../../../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";

// Cross-cutting chrome with its own providers; this suite is about the screen.
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ repoId: "r1" }),
}));

vi.mock("@/lib/repo-context", () => ({
  useActiveRepo: () => ({
    repoId: "r1",
    repos: [{ id: "r1", full_name: "acme/payments-api" }],
    activeRepo: null,
    setRepoId: vi.fn(),
    reposLoaded: true,
  }),
}));

import { ConventionsView } from "./ConventionsView";

const CANDIDATE = {
  id: "c1",
  repo_id: "r1",
  category: "async" as const,
  rule: "Always use async/await instead of .then() chains.",
  evidence_path: "src/api/users.ts",
  evidence_start_line: 23,
  evidence_end_line: 31,
  evidence_snippet: "const user = await db.users.find(id);",
  confidence: 0.91,
  status: "accepted" as const,
  created_at: "2026-09-20T10:00:00.000Z",
};

const SCANNED: ConventionsViewData = {
  scan: {
    id: "s1",
    repo_id: "r1",
    sample_count: 84,
    model: "openai/gpt-5.4",
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  candidates: [CANDIDATE],
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

beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderView() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ conventions, skills }}>
        <ToastProvider>
          <ConventionsView />
        </ToastProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("ConventionsView", () => {
  it("offers extraction, not a re-scan, on a repo that was never scanned", async () => {
    fetchMock.mockImplementation(() => jsonResponse({ scan: null, candidates: [] }));
    renderView();
    expect(await screen.findByText("No conventions extracted yet")).toBeInTheDocument();
    // Two separate controls, not one that renames itself: only the first-run
    // button is live before a scan exists.
    expect(screen.getByRole("button", { name: /Run Scan/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /ReScan/ })).toBeDisabled();
  });

  /**
   * "Scanned and found nothing" is a different answer from "never scanned" —
   * the first means the evidence gate dropped everything the model proposed,
   * and blaming the repo for that would send the reader looking in the wrong
   * place.
   */
  it("says so when a scan ran and nothing survived the evidence check", async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse({ scan: SCANNED.scan, candidates: [] }),
    );
    renderView();
    expect(await screen.findByText("Nothing survived the evidence check")).toBeInTheDocument();
  });

  it("reports how many files the scan read and how long ago it ran", async () => {
    fetchMock.mockImplementation(() => jsonResponse(SCANNED));
    renderView();
    expect(
      await screen.findByText("Detected from 84 sample files · last scan 1h ago"),
    ).toBeInTheDocument();
  });

  it("counts the accepted candidates above the list", async () => {
    fetchMock.mockImplementation(() => jsonResponse(SCANNED));
    renderView();
    expect(await screen.findByText("1 of 1 accepted")).toBeInTheDocument();
  });

  it("re-counts after a rejection without re-reading the list", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return jsonResponse({ ...CANDIDATE, status: "rejected" });
      }
      return jsonResponse(SCANNED);
    });
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: /Reject/ }));
    expect(await screen.findByText("0 of 1 accepted")).toBeInTheDocument();
  });

  it("hides the create-skill button until something is accepted", async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse({ ...SCANNED, candidates: [{ ...CANDIDATE, status: "rejected" }] }),
    );
    renderView();
    // A greyed button invites a click that does nothing; absence is the signal.
    await screen.findByText("0 of 1 accepted");
    expect(screen.queryByRole("button", { name: /Create skill/ })).not.toBeInTheDocument();
  });

  it("offers ReScan, not Run Scan, once a scan exists", async () => {
    fetchMock.mockImplementation(() => jsonResponse(SCANNED));
    renderView();
    await screen.findByText("1 of 1 accepted");
    expect(screen.getByRole("button", { name: /ReScan/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Run Scan/ })).toBeDisabled();
  });

  it("scans on demand and renders what came back", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? jsonResponse(SCANNED)
        : jsonResponse({ scan: null, candidates: [] }),
    );
    renderView();

    await screen.findByText("No conventions extracted yet");
    fireEvent.click(screen.getByRole("button", { name: /Run Scan/ }));
    expect(await screen.findByText(CANDIDATE.rule)).toBeInTheDocument();
  });

  it("surfaces a failed scan instead of leaving the button spinning", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? jsonResponse({ error: { code: "no_samples", message: "Nothing to sample." } }, 422)
        : jsonResponse({ scan: null, candidates: [] }),
    );
    renderView();

    await screen.findByText("No conventions extracted yet");
    fireEvent.click(screen.getByRole("button", { name: /Run Scan/ }));
    expect(await screen.findByText("Nothing to sample.")).toBeInTheDocument();
  });

  it("opens the create-skill modal on the server's draft", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/agents")) return jsonResponse([{ id: "ag1", name: "General Reviewer" }]);
      if (url.includes("skill-draft")) {
        return jsonResponse({
          name: "payments-api-conventions",
          description: "1 house convention extracted from payments-api",
          type: "convention",
          body: "# payments-api-conventions\n\n## async-await-instead\n",
          convention_ids: ["c1"],
          evidence_files: ["src/api/users.ts"],
        });
      }
      return jsonResponse(SCANNED);
    });
    renderView();

    fireEvent.click(await screen.findByRole("button", { name: /Create skill/ }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(within(dialog).getByLabelText("Name")).toHaveValue("payments-api-conventions"),
    );
    expect(
      within(dialog).getByText(
        "Merged from 1 accepted convention in acme/payments-api. Everything below is editable before you save.",
      ),
    ).toBeInTheDocument();
  });
});
