/**
 * CopyControl — copy, the 2-second "Copied", and the manual fallback when the
 * clipboard is unavailable (plan step 30a, AC-42, AC-76, AC-77).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import onboarding from "../../../../../../../../../messages/en/onboarding.json";
import { CopyControl } from "./CopyControl";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const renderCopy = () =>
  render(
    <NextIntlClientProvider locale="en" messages={{ onboarding }}>
      <CopyControl text="pnpm run dev" ariaLabel="Copy command 2" />
    </NextIntlClientProvider>,
  );

const withClipboard = (clipboard: unknown) => vi.stubGlobal("navigator", { ...navigator, clipboard });

describe("CopyControl", () => {
  it("AC-42, AC-76 — a click copies the text; Copied shows and goes away after 2,000 ms", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    withClipboard({ writeText });
    renderCopy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy command 2" }));
    });
    expect(writeText).toHaveBeenCalledWith("pnpm run dev");
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
    act(() => {
      vi.advanceTimersByTime(1_999);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("status")).not.toHaveTextContent("Copied");
  });

  it("AC-77 — writeText rejecting → a read-only field with the text and Copy it manually", async () => {
    withClipboard({ writeText: vi.fn(() => Promise.reject(new Error("denied"))) });
    renderCopy();
    fireEvent.click(screen.getByRole("button", { name: "Copy command 2" }));
    const field = await screen.findByRole("textbox");
    expect(field).toHaveValue("pnpm run dev");
    expect(field).toHaveAttribute("readonly");
    expect(screen.getByText("Copy it manually")).toBeInTheDocument();
    expect(screen.getByRole("status")).not.toHaveTextContent("Copied");
  });

  it("AC-77 — navigator.clipboard undefined → the same fallback", async () => {
    withClipboard(undefined);
    renderCopy();
    fireEvent.click(screen.getByRole("button", { name: "Copy command 2" }));
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("pnpm run dev"));
    expect(screen.getByText("Copy it manually")).toBeInTheDocument();
  });
});
