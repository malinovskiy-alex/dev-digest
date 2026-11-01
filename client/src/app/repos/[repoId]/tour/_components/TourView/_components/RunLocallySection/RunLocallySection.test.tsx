/**
 * RunLocallySection — numbered monospace commands with named copy buttons, or
 * the no-manifest message (plan step 30b: AC-39, AC-42, AC-43, AC-45).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { TourCommands } from "@devdigest/shared";
import onboarding from "../../../../../../../../../messages/en/onboarding.json";
import { RunLocallySection } from "./RunLocallySection";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const LIST: TourCommands = {
  commands: [
    { step: 1, command: "cp .env.example .env", comment: "create your env" },
    { step: 2, command: "docker compose up -d", comment: null },
    { step: 3, command: "pnpm install", comment: null },
  ],
  gap: null,
};

const renderList = (list: TourCommands) =>
  render(
    <NextIntlClientProvider locale="en" messages={{ onboarding }}>
      <RunLocallySection list={list} />
    </NextIntlClientProvider>,
  );

describe("RunLocallySection", () => {
  it("AC-39 — a numbered list with each command in monospace", () => {
    renderList(LIST);
    expect(screen.getByRole("list").tagName).toBe("OL");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    items.forEach((item, i) => expect(item).toHaveTextContent(new RegExp(`^${i + 1}\\.`)));
    expect(screen.getByText("docker compose up -d").tagName).toBe("CODE");
  });

  it("AC-43 — copy buttons are named Copy command 1 … N", () => {
    renderList(LIST);
    for (const n of [1, 2, 3]) expect(screen.getByRole("button", { name: `Copy command ${n}` })).toBeInTheDocument();
  });

  it("AC-42 — copying row 2 writes its command text without the step number", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    renderList(LIST);
    fireEvent.click(screen.getByRole("button", { name: "Copy command 2" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("docker compose up -d"));
  });

  it("AC-45 — no_manifest → No run commands found in the repository's manifests", () => {
    renderList({ commands: [], gap: "no_manifest" });
    expect(screen.getByText("No run commands found in the repository's manifests")).toBeInTheDocument();
  });
});
