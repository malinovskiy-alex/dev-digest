/**
 * BriefFileRef — plan step 25d: accessible name with path + line (R-58),
 * middle truncation with the full path in `title` (R-72, D-26), the
 * "via blast radius" tag (R-76) and the inline "not in diff" notice (R-56).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import brief from "../../../../../../../../messages/en/brief.json";
import { BriefFileRef } from "./BriefFileRef";

afterEach(cleanup);

type Props = React.ComponentProps<typeof BriefFileRef>;

function renderRef(p: Partial<Props> = {}) {
  const onActivate = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={{ brief }}>
      <BriefFileRef path="src/a.ts" line={12} inDiff notice={false} onActivate={onActivate} {...p} />
    </NextIntlClientProvider>,
  );
  return onActivate;
}

// 63 chars: well over the visible budget.
const LONG = "src/modules/billing/adapters/providers/stripe/webhook-handler.ts";

describe("BriefFileRef", () => {
  it("R-58 — a keyboard-reachable button named with the full path and line; activating it calls back", () => {
    const onActivate = renderRef({ path: LONG, line: 61 });
    const button = screen.getByRole("button", { name: `Open ${LONG} at line 61` });
    expect(button.tagName).toBe("BUTTON");
    expect(button).not.toHaveAttribute("tabindex", "-1");
    fireEvent.click(button);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("R-55, R-58 — a reference with no line is named with the path only", () => {
    renderRef({ path: "src/a.ts", line: null });
    expect(screen.getByRole("button", { name: "Open src/a.ts" })).toHaveTextContent(/^src\/a\.ts$/);
  });

  it("R-72 — a long path is cut in the middle, keeping the file name and line; the full form is the title", () => {
    renderRef({ path: LONG, line: 61 });
    const button = screen.getByRole("button", { name: `Open ${LONG} at line 61` });
    const shown = button.textContent ?? "";
    expect(shown).toContain("…");
    expect(shown.endsWith("/webhook-handler.ts:61")).toBe(true);
    expect(shown.startsWith("src/")).toBe(true);
    expect(shown.length).toBeLessThan(`${LONG}:61`.length);
    expect(button).toHaveAttribute("title", `${LONG}:61`);
  });

  it("R-49, R-72 — a range shows as <path>:<a>-<b>; a short path is not cut", () => {
    renderRef({ path: "src/a.ts", line: 12, lines: "12-18" });
    const button = screen.getByRole("button", { name: "Open src/a.ts at line 12" });
    expect(button).toHaveTextContent(/^src\/a\.ts:12-18$/);
    expect(button).toHaveAttribute("title", "src/a.ts:12-18");
  });

  it("R-76 — 'via blast radius' only for a file outside the PR's changed files", () => {
    renderRef({ inDiff: false });
    expect(screen.getByText("via blast radius")).toBeInTheDocument();
    cleanup();
    renderRef({ inDiff: true });
    expect(screen.queryByText("via blast radius")).not.toBeInTheDocument();
  });

  it("R-56 — the notice is a status next to the reference, only while asked for", () => {
    renderRef({ inDiff: false, notice: true });
    expect(screen.getByRole("status")).toHaveTextContent("File not in this PR's diff");
    cleanup();
    renderRef({ inDiff: false, notice: false });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
