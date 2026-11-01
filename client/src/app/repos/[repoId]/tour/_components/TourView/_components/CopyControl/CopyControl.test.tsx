/**
 * CopyControl — copy, the 2-second "Copied", and the manual fallback when the
 * clipboard is unavailable (plan step 30a, AC-42, AC-76, AC-77).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import onboarding from "../../../../../../../../../messages/en/onboarding.json";
import { Icon } from "@devdigest/ui";
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

  // UI-D-6: the header's "Share link" carries a link icon; a command row keeps
  // the copy icon. The icon is decorative (aria-hidden), so it is compared by
  // its drawn shape with the @devdigest/ui icon itself.
  it("UI-D-6 — the icon prop picks the leading icon; it stays decorative and the default is Copy", () => {
    const shapeOf = (I: (typeof Icon)[keyof typeof Icon]) => {
      const { container, unmount } = render(<I size={16} aria-hidden="true" />);
      const html = container.querySelector("svg")!.innerHTML;
      unmount();
      return html;
    };
    const link = shapeOf(Icon.Link);
    const copy = shapeOf(Icon.Copy);
    expect(link).not.toBe(copy);

    render(
      <NextIntlClientProvider locale="en" messages={{ onboarding }}>
        <CopyControl text="u" label="Share link" ariaLabel="Copy a link to this tour" icon="Link" />
        <CopyControl text="pnpm run dev" ariaLabel="Copy command 2" />
      </NextIntlClientProvider>,
    );
    const share = screen.getByRole("button", { name: "Copy a link to this tour" });
    const shareIcon = share.querySelector("svg")!;
    expect(shareIcon.innerHTML).toBe(link);
    expect(shareIcon).toHaveAttribute("aria-hidden", "true");
    expect(share).toHaveTextContent("Share link");

    const cmd = screen.getByRole("button", { name: "Copy command 2" });
    expect(cmd.querySelector("svg")!.innerHTML).toBe(copy);
    expect(cmd.textContent).toBe(""); // icon-only
  });
});
