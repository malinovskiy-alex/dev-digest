import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/agents.json";
import { ToastProvider } from "@/lib/toast";

/**
 * A model id only means something to the provider it came from, so the two
 * fields have to move together. These cover that: switching provider re-picks
 * the model, and the cases where re-picking would be destructive.
 */

const MODELS: Record<string, { id: string; provider: string }[]> = {
  openai: [{ id: "gpt-4.1", provider: "openai" }],
  anthropic: [
    { id: "claude-haiku-4-5", provider: "anthropic" },
    { id: "claude-sonnet-4-6", provider: "anthropic" },
  ],
  openrouter: [],
};

const mutate = vi.fn();

vi.mock("@/lib/hooks/agents", () => ({
  useUpdateAgent: () => ({ mutate, isPending: false, isSuccess: false, data: undefined }),
  useProviderModels: (provider: string) => ({ data: MODELS[provider] }),
}));

import { ConfigTab } from "./ConfigTab";

const AGENT: Agent = {
  id: "ag1",
  name: "Security Reviewer",
  description: "Flags secrets and injection",
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "You are a security reviewer.",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 1,
  skill_count: 2,
};

beforeEach(() => mutate.mockReset());
afterEach(cleanup);

function renderTab(agent: Agent = AGENT) {
  render(
    <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
      <ToastProvider>
        <ConfigTab agent={agent} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

/**
 * Provider is a SearchableSelect, not a native `<select>` — it renders the
 * current value as text and its options as clickable rows, so driving it means
 * opening it and clicking the row. Provider names never collide with model ids,
 * which is what keeps these `getByText` calls unambiguous.
 */
function pickProvider(from: string, to: string) {
  fireEvent.click(screen.getByText(from));
  fireEvent.click(screen.getByText(to));
}

describe("ConfigTab — provider and model move together", () => {
  it("keeps the saved pair on load", () => {
    renderTab();
    expect(screen.getByText("gpt-4.1")).toBeInTheDocument();
  });

  it("re-picks the model when the provider changes", async () => {
    renderTab();
    pickProvider("openai", "anthropic");

    // gpt-4.1 is meaningless to Anthropic; the first model it offers wins.
    await waitFor(() => expect(screen.getByText("claude-haiku-4-5")).toBeInTheDocument());
    expect(screen.queryByText("gpt-4.1")).not.toBeInTheDocument();
  });

  it("saves the new pair, not the stale model", async () => {
    renderTab();
    pickProvider("openai", "anthropic");
    await waitFor(() => expect(screen.getByText("claude-haiku-4-5")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    expect(mutate).toHaveBeenCalled();
    const patch = mutate.mock.calls[0]![0].patch;
    expect(patch.provider).toBe("anthropic");
    expect(patch.model).toBe("claude-haiku-4-5");
  });

  /**
   * An empty list means the key is missing or `listModels` failed. Blanking the
   * field there would throw away the user's setting over a transient error, and
   * `modelEmptyHint` already explains what happened.
   */
  it("leaves the model alone when the new provider offers nothing", async () => {
    renderTab();
    pickProvider("openai", "openrouter");

    await waitFor(() => expect(screen.getByText("openrouter")).toBeInTheDocument());
    expect(screen.getByText("gpt-4.1")).toBeInTheDocument();
  });

  it("offers every provider as a row in the list, not a native select", () => {
    renderTab();
    fireEvent.click(screen.getByText("openai"));
    for (const p of ["openai", "anthropic", "openrouter"]) {
      expect(screen.getAllByText(p).length).toBeGreaterThan(0);
    }
  });

  it("does not fight the user's own choice within one provider", async () => {
    const onAnthropic: Agent = { ...AGENT, provider: "anthropic", model: "claude-sonnet-4-6" };
    renderTab(onAnthropic);

    // The saved pair is valid, so nothing should snap it to the list's first entry.
    await waitFor(() => expect(screen.getByText("claude-sonnet-4-6")).toBeInTheDocument());
    expect(screen.queryByText("claude-haiku-4-5")).not.toBeInTheDocument();
  });
});
