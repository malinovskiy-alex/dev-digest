/**
 * ArchitectureSection — model prose rendered as untrusted markdown, the
 * diagram when there is one, the skeleton's stack and folder lists otherwise
 * (plan step 30b: AC-30, AC-31, AC-34, AC-62, AC-85).
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { TourArchitecture } from "@devdigest/shared";
import onboarding from "../../../../../../../../../messages/en/onboarding.json";
import context from "../../../../../../../../../messages/en/context.json";
import common from "../../../../../../../../../messages/en/common.json";
import { ArchitectureSection } from "./ArchitectureSection";

afterEach(() => {
  cleanup();
  delete (window as unknown as { __tourPwned?: boolean }).__tourPwned;
});

const base: TourArchitecture = {
  prose: null,
  components: [],
  connections: [],
  stack: { languages: [{ name: "TypeScript", files: 120 }, { name: "JavaScript", files: 4 }], frameworks: ["React", "Fastify"], runtime: ["Node.js", "pnpm"] },
  folders: [
    { path: "src", files: 100 },
    { path: "scripts", files: 4 },
  ],
  gap: null,
};

function renderSection(a: Partial<TourArchitecture>) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ onboarding, context, common }}>
      <ArchitectureSection architecture={{ ...base, ...a }} />
    </NextIntlClientProvider>,
  );
}

describe("ArchitectureSection", () => {
  it("AC-30, AC-31 — the prose renders; a path in backticks is <code> with its underscores intact", () => {
    renderSection({ prose: "Requests enter at `src/my_file.ts` and flow to the ledger." });
    expect(screen.getByText(/flow to the ledger/)).toBeInTheDocument();
    const code = screen.getByText("src/my_file.ts");
    expect(code.tagName).toBe("CODE");
  });

  it("AC-62 — embedded HTML, images and relative links stay inert", () => {
    const { container } = renderSection({
      prose: [
        "Intro text.",
        "",
        "<script>window.__tourPwned = true</script>",
        '<img src=x onerror="window.__tourPwned = true">',
        "",
        "![a](http://x/y.png)",
        "",
        "See [r](./rel.md) for more.",
      ].join("\n"),
    });
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("r").closest("a")).toBeNull();
    expect((window as unknown as { __tourPwned?: boolean }).__tourPwned).toBeUndefined();
  });

  it.each([
    ["null", null],
    ["empty (scrubbed to nothing)", ""],
  ])("F-56, AC-85 — prose %s + a grounded diagram → the diagram still renders, with the stack and folders", (_case, prose) => {
    renderSection({
      prose,
      components: [
        { id: "api", label: "API", kind: "api" },
        { id: "db", label: "Postgres", kind: "data" },
      ],
      connections: [{ from: "api", to: "db" }],
    });
    expect(screen.getByRole("img", { name: /2 components/ })).toBeInTheDocument();
    expect(screen.getByText("Frameworks: React, Fastify")).toBeInTheDocument();
    expect(screen.getByText("src/ · 100 files")).toBeInTheDocument();
  });

  it("F-56 — prose null and too few components → no diagram (AC-85 threshold unchanged)", () => {
    renderSection({ components: [{ id: "api", label: "API", kind: "api" }], connections: [] });
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("AC-85 — no components → no diagram and no error text", () => {
    renderSection({ prose: "Just prose." });
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Just prose.")).toBeInTheDocument();
  });

  it("AC-32 — with grounded components and a connection the diagram draws under the prose", () => {
    renderSection({
      prose: "Prose.",
      components: [
        { id: "api", label: "API", kind: "api" },
        { id: "db", label: "Postgres", kind: "data" },
      ],
      connections: [{ from: "api", to: "db" }],
    });
    expect(screen.getByRole("img", { name: /2 components/ })).toBeInTheDocument();
  });

  it("AC-34 — a skeleton lists the stack and the folders with counts, and no prose", () => {
    const { container } = renderSection({});
    expect(screen.getByText("Languages: TypeScript · 120 files, JavaScript · 4 files")).toBeInTheDocument();
    expect(screen.getByText("Frameworks: React, Fastify")).toBeInTheDocument();
    expect(screen.getByText("src/ · 100 files")).toBeInTheDocument();
    expect(screen.getByText("scripts/ · 4 files")).toBeInTheDocument();
    expect(container.querySelector("p code")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  /*
   * Regression for finding F-29 (D-26 (3), AC-61, AC-62): the server scrub is
   * best effort, so the tour prose must render no link whatever markdown way
   * the model (or a prompt-injected README) found to make one — an
   * entity-encoded or backslash-escaped autolink literal, one inside emphasis,
   * an inline link, a reference link with its definition, an image.
   */
  it("F-29, AC-62 — tour prose renders no <a> and no <img> for any kind of link or image", () => {
    const prose = [
      "Entity: &#104;ttps://evil.example/a now.",
      "",
      "Escaped: https\\://evil.example/b now.",
      "",
      "Emphasis: _https://evil.example/c_ now.",
      "",
      "Inline: [t](https://x) now.",
      "",
      "Reference: [log in][r] now.",
      "",
      "[r]: https://evil.example/r",
      "",
      "Image: ![logo](https://evil.example/p.png) now.",
    ].join("\n");
    renderSection({ prose });
    // the text is still there to read
    expect(screen.getByText(/Inline:/)).toHaveTextContent("Inline: t now.");
    expect(screen.getByText(/Reference:/)).toHaveTextContent("Reference: log in now.");
    // no link role at all …
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    // … and no anchor or image element either: an <a> without href has no link
    // role, so only a DOM query can prove it is absent.
    expect(document.querySelectorAll("a, img")).toHaveLength(0);
  });
});
