import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../messages/en/agents.json";
import { ToastProvider } from "@/lib/toast";

/**
 * This form used to take the model as free text seeded with a hardcoded
 * `gpt-4.1`, so choosing Anthropic created an agent whose first run could only
 * fail. The model is a list scoped to the provider now, and these pin that.
 */

const MODELS: Record<string, { id: string; provider: string }[]> = {
  openai: [{ id: "gpt-4.1", provider: "openai" }],
  anthropic: [
    { id: "claude-haiku-4-5", provider: "anthropic" },
    { id: "claude-sonnet-4-6", provider: "anthropic" },
  ],
  openrouter: [],
};

const mutateAsync = vi.fn(async () => ({ id: "ag9" }));
const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/hooks/agents", () => ({
  useCreateAgent: () => ({ mutateAsync, isPending: false }),
  useProviderModels: (provider: string) => ({ data: MODELS[provider] }),
}));

import { CreateAgentModal } from "./CreateAgentModal";

beforeEach(() => {
  mutateAsync.mockClear();
  push.mockClear();
});
afterEach(cleanup);

function renderModal() {
  render(
    <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
      <ToastProvider>
        <CreateAgentModal onClose={() => {}} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

/** Both pickers are SearchableSelects: open by clicking the value, then the row. */
function pick(from: string, to: string) {
  fireEvent.click(screen.getByText(from));
  fireEvent.click(screen.getByText(to));
}

describe("CreateAgentModal — the model is a list scoped to the provider", () => {
  it("offers the provider's models rather than a free-text box", () => {
    renderModal();
    fireEvent.click(screen.getByText("gpt-4.1"));
    // The search box of the model picker, not a value input.
    expect(screen.getByPlaceholderText("Search models…")).toBeInTheDocument();
  });

  it("re-picks the model when the provider changes", async () => {
    renderModal();
    pick("openai", "anthropic");
    await waitFor(() => expect(screen.getByText("claude-haiku-4-5")).toBeInTheDocument());
    expect(screen.queryByText("gpt-4.1")).not.toBeInTheDocument();
  });

  it("creates the agent with the pair actually chosen", async () => {
    renderModal();
    pick("openai", "anthropic");
    await waitFor(() => expect(screen.getByText("claude-haiku-4-5")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Create/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0]![0]).toMatchObject({
      provider: "anthropic",
      model: "claude-haiku-4-5",
    });
  });

  it("keeps the default model when the provider lists none", async () => {
    renderModal();
    pick("openai", "openrouter");
    await waitFor(() => expect(screen.getByText("openrouter")).toBeInTheDocument());
    expect(screen.getByText("gpt-4.1")).toBeInTheDocument();
  });
});
