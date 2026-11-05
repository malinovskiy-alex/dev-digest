import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import skills from "../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";

// L08 skill-stats R-29, R-53 — switching skill (or tab) keeps the Stats tab's range in the address.

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const push = vi.fn();
const replace = vi.fn();
let search = new URLSearchParams();
let paramsId = "s1";
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: paramsId }),
  useSearchParams: () => search,
  useRouter: () => ({ push, replace }),
}));

const skill = (id: string, name: string): Skill => ({
  id,
  name,
  description: "",
  type: "security",
  source: "manual",
  body: "",
  enabled: true,
  version: 1,
  agent_count: 2,
});
const LIST = [skill("s1", "OWASP Top 10"), skill("s2", "Flaky test gate")];

vi.mock("@/lib/hooks/skills", () => ({
  useSkills: () => ({ data: LIST }),
  useSkill: () => ({ data: LIST[0], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useUpdateSkill: () => ({ mutate: vi.fn() }),
  useDeleteSkill: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));
// The pull-frequency read is the real hook over a stubbed fetch: the remount case needs its cache.
const pullFreqFetch = vi.fn();
function stubPullFrequency() {
  pullFreqFetch.mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () =>
        Promise.resolve({
          range: {},
          skills: [
            { skill_id: "s1", pull_frequency: { prs_with_skill: 2, prs_reviewed: 2, rate: 1 } },
            { skill_id: "s2", pull_frequency: { prs_with_skill: 0, prs_reviewed: 0, rate: null } },
          ],
        }),
    } as Response),
  );
  vi.stubGlobal("fetch", pullFreqFetch);
}

// The editor body is not under test here; it only has to expose a tab switch.
vi.mock("./_components/SkillEditor", () => ({
  SKILL_EDITOR_TABS: [{ key: "config" }, { key: "preview" }, { key: "stats" }, { key: "versions" }, { key: "context" }],
  SkillEditor: ({ onTab }: { onTab: (t: string) => void }) => (
    <button type="button" onClick={() => onTab("config")}>
      to-config
    </button>
  ),
}));

import SkillEditorPage from "./page";

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  pullFreqFetch.mockReset();
  stubPullFrequency();
  paramsId = "s1";
  search = new URLSearchParams("tab=stats&range=custom&start=2026-11-01&end=2026-11-03");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function newClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** `qc` is shared when a test remounts the page the way the App Router does on a rail click. */
function renderPage(qc: QueryClient = newClient()) {
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ skills }}>
        <ToastProvider>
          <SkillEditorPage />
        </ToastProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("SkillEditorPage address (L08 skill-stats C11)", () => {
  it("keeps the tab and the range when switching skill in the rail, and the range when switching tab (R-29, R-53)", () => {
    renderPage();
    fireEvent.click(screen.getByText("Flaky test gate"));
    expect(push).toHaveBeenCalledWith("/skills/s2?tab=stats&range=custom&start=2026-11-01&end=2026-11-03");

    fireEvent.click(screen.getByRole("button", { name: "to-config" }));
    expect(replace).toHaveBeenCalledWith("/skills/s1?tab=config&range=custom&start=2026-11-01&end=2026-11-03");
  });

  it("shows each rail card's pull frequency from the page's one read, and keeps it across the remount a rail click causes (R-71, R-74, F-04)", async () => {
    const qc = newClient();
    const first = renderPage(qc);
    expect(await screen.findByText("2 agents · 100% pull freq")).toBeInTheDocument();
    expect(screen.getByText("2 agents · — pull freq")).toBeInTheDocument();
    expect(pullFreqFetch).toHaveBeenCalledTimes(1);

    // Rail click → the App Router unmounts /skills/s1 and mounts /skills/s2 over the same cache.
    fireEvent.click(screen.getByText("Flaky test gate"));
    first.unmount();
    paramsId = "s2";
    renderPage(qc);
    // No placeholder, no second GET: the cards keep their figures.
    expect(screen.getByText("2 agents · 100% pull freq")).toBeInTheDocument();
    expect(screen.queryByText("Loading pull frequency")).not.toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 0));
    expect(pullFreqFetch).toHaveBeenCalledTimes(1);
  });
});
