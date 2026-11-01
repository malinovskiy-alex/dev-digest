/**
 * RunLocallySection — numbered monospace commands with named copy buttons, or
 * the no-manifest message (plan step 30b: AC-39, AC-42, AC-43, AC-45).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { TourCommands } from "@devdigest/shared";
import onboarding from "../../../../../../../../../messages/en/onboarding.json";
import { RunLocallySection } from "./RunLocallySection";
import { commentParts } from "./helpers";

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
    // UI-D-13 (F-46): the step number without a dot, the command in code, the
    // comment as "# …" — each part asserted on its own.
    items.forEach((item, i) => {
      expect(within(item).getByText(String(i + 1), { exact: true })).toBeInTheDocument();
      expect(item.textContent!.startsWith(`${i + 1}.`)).toBe(false);
      expect(within(item).getByText(LIST.commands[i]!.command).tagName).toBe("CODE");
    });
    const comment = within(items[0]!).getByText("# create your env", { exact: true });
    expect(comment.tagName).not.toBe("CODE");
    expect(within(items[0]!).getByText("cp .env.example .env")).not.toContainElement(comment);
    // no comment → no "#"
    expect(items[1]!.textContent).not.toContain("#");
    expect(screen.getByText("docker compose up -d").tagName).toBe("CODE");
  });

  it("F-44 — backtick spans of a comment render as code, without the backticks", () => {
    renderList({ commands: [{ step: 1, command: "pnpm run build", comment: "writes `distribution/` from `source/`" }], gap: null });
    const item = screen.getByRole("listitem");
    expect(within(item).getByText("distribution/").tagName).toBe("CODE");
    expect(within(item).getByText("source/").tagName).toBe("CODE");
    expect(item.textContent).not.toContain("`");
    expect(item.textContent).toContain("# writes distribution/ from source/");
  });

  it("F-44 — commentParts: paired backticks → code parts; an unpaired backtick and plain text stay as they are", () => {
    expect(commentParts("writes `dist/` now")).toEqual([
      { text: "writes ", code: false },
      { text: "dist/", code: true },
      { text: " now", code: false },
    ]);
    expect(commentParts("`a``b`")).toEqual([
      { text: "a", code: true },
      { text: "b", code: true },
    ]);
    expect(commentParts("an unpaired ` tick")).toEqual([{ text: "an unpaired ` tick", code: false }]);
    expect(commentParts("one `span` and a stray `")).toEqual([
      { text: "one ", code: false },
      { text: "span", code: true },
      { text: " and a stray `", code: false },
    ]);
    expect(commentParts("no code here")).toEqual([{ text: "no code here", code: false }]);
    expect(commentParts("")).toEqual([]);
    // no markup is parsed: HTML stays text
    expect(commentParts("<b>x</b>")).toEqual([{ text: "<b>x</b>", code: false }]);
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
