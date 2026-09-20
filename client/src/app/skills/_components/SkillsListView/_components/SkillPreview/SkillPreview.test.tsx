import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";
import { SkillPreview } from "./SkillPreview";

const SKILL: Skill = {
  id: "sk1",
  name: "flake-patterns",
  description: "Flag sleeps, real clocks and network calls in unit tests.",
  type: "convention",
  source: "imported_file",
  body: "# Flake patterns\n\nA unit test that sleeps is a unit test that flakes.",
  enabled: false,
  version: 3,
};

const fetchMock = vi.fn();

function jsonOk(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve(body),
  } as Response);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPreview() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
        <ToastProvider>
          <SkillPreview skillId="sk1" />
        </ToastProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("SkillPreview", () => {
  it("renders the body, the version and the untrusted notice for an imported skill", async () => {
    fetchMock.mockImplementation(() => jsonOk(SKILL));
    renderPreview();

    expect(await screen.findByText("Flake patterns")).toBeInTheDocument();
    expect(
      screen.getByText("A unit test that sleeps is a unit test that flakes."),
    ).toBeInTheDocument();
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText("Imported")).toBeInTheDocument();
    expect(screen.getByText(/came from outside/)).toBeInTheDocument();
  });

  it("carries the directive hint on the description field in edit mode", async () => {
    fetchMock.mockImplementation(() => jsonOk(SKILL));
    renderPreview();

    fireEvent.click(await screen.findByText("Edit"));
    expect(screen.getByText(/This is the skill's interface/)).toBeInTheDocument();
  });

  it("saves a changed body through the update mutation", async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      jsonOk(init?.method === "PUT" ? { ...SKILL, body: "# Flake patterns v2", version: 4 } : SKILL),
    );
    renderPreview();

    fireEvent.click(await screen.findByText("Edit"));

    // Identity normalizer: the default one collapses the body's newlines.
    const body = screen.getByDisplayValue(SKILL.body, { normalizer: (v) => v });
    fireEvent.change(body, { target: { value: "# Flake patterns v2" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      const put = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "PUT");
      expect(put).toBeDefined();
      expect(String(put?.[0])).toContain("/skills/sk1");
      // Only what actually changed is sent — the body is what mints a version.
      expect(JSON.parse(String((put?.[1] as RequestInit).body))).toEqual({
        body: "# Flake patterns v2",
      });
    });

    expect(await screen.findByText("Saved (v4)")).toBeInTheDocument();
  });

  it("leaves edit mode without a request when nothing changed", async () => {
    fetchMock.mockImplementation(() => jsonOk(SKILL));
    renderPreview();

    fireEvent.click(await screen.findByText("Edit"));
    fireEvent.click(screen.getByText("Save"));

    await screen.findByText("Edit");
    expect(fetchMock.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "PUT")).toBe(
      false,
    );
  });
});
