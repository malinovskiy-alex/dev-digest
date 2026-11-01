import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import context from "../../../messages/en/context.json";
import { UntrustedMarkdown } from "./UntrustedMarkdown";

afterEach(cleanup);

function renderMd(md: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ context }}>
      <UntrustedMarkdown>{md}</UntrustedMarkdown>
    </NextIntlClientProvider>,
  );
}

const relTokens = (el: HTMLElement) => (el.getAttribute("rel") ?? "").split(/\s+/);

describe("UntrustedMarkdown", () => {
  it("renders no <img> for a repo doc's images: a web image becomes a new-tab link with its alt, a local one plain text (F-08)", () => {
    renderMd("Logo: ![logo](https://evil.example/p.png)\n\nLocal: ![](./local.png)");

    // nothing is fetched on open: no <img> element at all (an alt="" image would not even have role img)
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();

    const remote = screen.getByRole("link", { name: "Image: logo" });
    expect(remote).toHaveAttribute("href", "https://evil.example/p.png");
    expect(remote).toHaveAttribute("target", "_blank");
    expect(relTokens(remote)).toContain("noopener");

    // the local image is a label only: visible, never a link
    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Image" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("a web link opens in a new tab with noopener; a relative or anchor link is shown as non-link text (F-13)", () => {
    renderMd("See [site](https://example.com/x), [other](./other.md) and [top](#top).");

    const web = screen.getByRole("link", { name: "site" });
    expect(web).toHaveAttribute("href", "https://example.com/x");
    expect(web).toHaveAttribute("target", "_blank");
    expect(relTokens(web)).toEqual(expect.arrayContaining(["noopener", "noreferrer"]));

    expect(screen.getByText("other")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "other" })).not.toBeInTheDocument();
    expect(screen.getByText("top")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "top" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toEqual([web]);
  });

  it("F-29 — without inertLinks (Project Context) a web link is still a normal new-tab link", () => {
    renderMd("Docs at [the site](https://example.com/docs) and https://example.com/raw.");
    const named = screen.getByRole("link", { name: "the site" });
    expect(named).toHaveAttribute("href", "https://example.com/docs");
    expect(named).toHaveAttribute("target", "_blank");
    expect(relTokens(named)).toContain("noopener");
    expect(screen.getByRole("link", { name: "https://example.com/raw" })).toHaveAttribute("href", "https://example.com/raw");
  });
});
