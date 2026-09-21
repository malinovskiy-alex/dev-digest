import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate } from "@devdigest/shared";
import messages from "../../../../../../../../../messages/en/conventions.json";
import { ConventionCard } from "./ConventionCard";

const CANDIDATE: ConventionCandidate = {
  id: "c1",
  repo_id: "r1",
  category: "async",
  rule: "Always use async/await instead of .then() chains.",
  evidence_path: "src/api/users.ts",
  evidence_start_line: 23,
  evidence_end_line: 31,
  evidence_snippet: "const user = await db.users.find(id);",
  confidence: 0.91,
  status: "accepted",
  created_at: "2026-09-20T10:00:00.000Z",
};

afterEach(cleanup);

function renderCard(over: Partial<ConventionCandidate> = {}) {
  const onStatusChange = vi.fn();
  const onEdit = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
      <ConventionCard
        candidate={{ ...CANDIDATE, ...over }}
        onStatusChange={onStatusChange}
        onEdit={onEdit}
      />
    </NextIntlClientProvider>,
  );
  return { onStatusChange, onEdit };
}

describe("ConventionCard", () => {
  it("shows the rule, its evidence reference and the real snippet", () => {
    renderCard();
    expect(screen.getByText(CANDIDATE.rule)).toBeInTheDocument();
    expect(screen.getByText("src/api/users.ts:23-31")).toBeInTheDocument();
    expect(screen.getByText("const user = await db.users.find(id);")).toBeInTheDocument();
  });

  it("reads a single-line evidence range without a range", () => {
    renderCard({ evidence_start_line: 9, evidence_end_line: 9 });
    expect(screen.getByText("src/api/users.ts:9")).toBeInTheDocument();
  });

  it("states the confidence as a number, not only as a bar", () => {
    renderCard();
    expect(screen.getByText("91%")).toBeInTheDocument();
  });

  /**
   * The state has to be legible without colour: `aria-pressed` is what a screen
   * reader gets, and the label is what everyone else reads.
   */
  it("names the current state on the buttons and in aria-pressed", () => {
    renderCard();
    expect(screen.getByRole("button", { name: /Accepted/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Reject/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("flips the labels once the candidate is rejected", () => {
    renderCard({ status: "rejected" });
    expect(screen.getByRole("button", { name: /^Accept$/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: /Rejected/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("reports a rejection to the caller", () => {
    const { onStatusChange } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: /Reject/ }));
    expect(onStatusChange).toHaveBeenCalledWith("rejected");
  });

  it("edits the rule and hands back both fields", () => {
    const { onEdit } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Edit rule" }));

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Never chain .then()." } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onEdit).toHaveBeenCalledWith({ rule: "Never chain .then().", category: "async" });
  });

  it("refuses to save an empty rule", () => {
    const { onEdit } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Edit rule" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("drops an abandoned draft instead of carrying it into the next edit", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Edit rule" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "half-written" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "Edit rule" }));
    expect(screen.getByRole("textbox")).toHaveValue(CANDIDATE.rule);
  });
});
