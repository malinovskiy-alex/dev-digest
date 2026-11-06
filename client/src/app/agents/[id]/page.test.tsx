import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent } from "@devdigest/shared";
import agents from "../../../../messages/en/agents.json";
import { ToastProvider } from "@/lib/toast";

// L08 F-13 — switching agent (or tab) keeps the Stats tab's range in the address.

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const push = vi.fn();
const replace = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "a1" }),
  useSearchParams: () => search,
  useRouter: () => ({ push, replace }),
}));

const agent = (id: string, name: string): Agent => ({
  id,
  name,
  description: "",
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 1,
  skill_count: 0,
});
const LIST = [agent("a1", "Security Reviewer"), agent("a2", "Style Checker")];

vi.mock("@/lib/hooks/agents", () => ({
  useAgents: () => ({ data: LIST }),
  useAgent: () => ({ data: LIST[0], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useUpdateAgent: () => ({ mutate: vi.fn() }),
  useDeleteAgent: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

// The editor body is not under test here; it only has to expose a tab switch.
vi.mock("./_components/AgentEditor", () => ({
  AgentEditor: ({ onTab }: { onTab: (t: string) => void }) => (
    <button type="button" onClick={() => onTab("config")}>
      to-config
    </button>
  ),
}));

import AgentEditorPage from "./page";

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  search = new URLSearchParams("tab=stats&range=custom&start=2026-10-01&end=2026-10-07");
});
afterEach(cleanup);

function renderPage() {
  render(
    <NextIntlClientProvider locale="en" messages={{ agents }}>
      <ToastProvider>
        <AgentEditorPage />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("AgentEditorPage address", () => {
  it("keeps the range when switching agent from the list and when switching tab (R-84, F-13)", () => {
    renderPage();
    fireEvent.click(screen.getByText("Style Checker"));
    expect(push).toHaveBeenCalledWith("/agents/a2?tab=stats&range=custom&start=2026-10-01&end=2026-10-07");

    fireEvent.click(screen.getByRole("button", { name: "to-config" }));
    expect(replace).toHaveBeenCalledWith("/agents/a1?tab=config&range=custom&start=2026-10-01&end=2026-10-07");
  });
});
