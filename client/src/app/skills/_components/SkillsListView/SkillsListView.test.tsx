import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";

// The shell is cross-cutting chrome (nav, palette, g-then-key shortcuts) with
// its own providers; this suite is about the list, so stand it in.
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Selecting a card is a navigation now, not a local selection — the skill's own
// screen at /skills/:id owns editing, preview and history.
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { SkillsListView } from "./SkillsListView";

const SKILL: Skill = {
  id: "sk1",
  name: "uncovered-branch-gate",
  description: "Name the branches of a changed function that no test reaches.",
  type: "rubric",
  source: "manual",
  body: "# Uncovered branch gate\n\nEnumerate every branch of every changed function.",
  enabled: true,
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

beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderList() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
        <ToastProvider>
          <SkillsListView />
        </ToastProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("SkillsListView", () => {
  it("shows a busy grid while the skills load", () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    renderList();

    expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
    // `busy` disambiguates the skeleton grid from the toast region, which is
    // also a live status area.
    expect(screen.getByRole("status", { busy: true })).toBeInTheDocument();
    expect(screen.queryByText("No skills yet")).not.toBeInTheDocument();
  });

  it("offers a retry when the list fails to load", async () => {
    fetchMock.mockImplementation(() => jsonResponse({ error: { code: "boom", message: "boom" } }, 500));
    renderList();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load skills.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("invites the first skill when the workspace has none", async () => {
    fetchMock.mockImplementation(() => jsonResponse([]));
    renderList();

    expect(await screen.findByText("No skills yet")).toBeInTheDocument();
  });

  it("opens the skill's own screen when a card is clicked", async () => {
    fetchMock.mockImplementation((url: string) =>
      String(url).endsWith("/skills") ? jsonResponse([SKILL]) : jsonResponse(SKILL),
    );
    renderList();

    fireEvent.click(await screen.findByText("uncovered-branch-gate"));

    expect(push).toHaveBeenCalledWith("/skills/sk1?tab=config");
  });

  it("filters the grid by name", async () => {
    const other: Skill = { ...SKILL, id: "sk2", name: "over-mocking-gate", description: "Mocks." };
    fetchMock.mockImplementation((url: string) =>
      String(url).endsWith("/skills") ? jsonResponse([SKILL, other]) : jsonResponse(SKILL),
    );
    renderList();

    await screen.findByText("over-mocking-gate");
    fireEvent.change(screen.getByLabelText("Search skills…"), { target: { value: "branch" } });

    expect(screen.getByText("uncovered-branch-gate")).toBeInTheDocument();
    expect(screen.queryByText("over-mocking-gate")).not.toBeInTheDocument();
  });

  it("writes `enabled` when a card's kill-switch is flipped", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? jsonResponse({ ...SKILL, enabled: false })
        : String(url).endsWith("/skills")
          ? jsonResponse([SKILL])
          : jsonResponse(SKILL),
    );
    renderList();

    fireEvent.click(await screen.findByRole("switch"));

    await waitFor(() => {
      const put = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "PUT");
      expect(put).toBeDefined();
      expect(JSON.parse(String((put?.[1] as RequestInit).body))).toEqual({ enabled: false });
    });
  });
});
