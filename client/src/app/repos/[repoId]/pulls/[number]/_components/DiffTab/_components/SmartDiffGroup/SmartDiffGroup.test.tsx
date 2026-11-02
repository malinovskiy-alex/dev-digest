import { describe, it, expect, afterEach } from "vitest";
import type React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrFile, SmartDiffGroup as SmartDiffGroupData } from "@devdigest/shared";
import prReview from "../../../../../../../../../../messages/en/prReview.json";
import shell from "../../../../../../../../../../messages/en/shell.json";
import { SmartDiffGroup } from "./SmartDiffGroup";

afterEach(cleanup);

const prFile = (path: string): PrFile => ({
  path,
  additions: 1,
  deletions: 0,
  patch: "@@ -1,1 +1,2 @@\n a\n+b",
});

function renderGroup(group: SmartDiffGroupData) {
  render(
    <NextIntlClientProvider locale="en" messages={{ prReview, shell }}>
      <SmartDiffGroup group={group} files={group.files.map((f) => prFile(f.path))} />
    </NextIntlClientProvider>,
  );
}

describe("SmartDiffGroup", () => {
  it("starts a boilerplate group collapsed and expands it on a header click", () => {
    renderGroup({
      role: "boilerplate",
      files: [{ path: "pnpm-lock.yaml", additions: 1, deletions: 0, finding_lines: [] }],
    });
    const header = screen.getByRole("button", { name: /Boilerplate/ });
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Generated / mechanical — skim")).toBeInTheDocument();
    expect(screen.getByText("1 file")).toBeInTheDocument();
    expect(screen.queryByText("pnpm-lock.yaml")).not.toBeInTheDocument();

    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("pnpm-lock.yaml")).toBeInTheDocument();
  });

  it("starts a core group open and counts the files that have findings", () => {
    renderGroup({
      role: "core",
      files: [
        { path: "src/config.ts", additions: 1, deletions: 0, finding_lines: [2, 9] },
        { path: "src/billing.ts", additions: 1, deletions: 0, finding_lines: [] },
      ],
    });
    expect(screen.getByRole("button", { name: /Core/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("The substance of the change — review closely")).toBeInTheDocument();
    expect(screen.getByText("src/config.ts")).toBeInTheDocument();
    expect(screen.getByText("src/billing.ts")).toBeInTheDocument();
    expect(screen.getByText("2 files")).toBeInTheDocument();
    // one FILE has findings (it has two finding lines — files are counted, not lines)
    const counter = screen.getByRole("img", { name: "1 file has findings" });
    expect(counter).toHaveTextContent("1");
  });

  it("shows no findings counter when no file has findings", () => {
    renderGroup({
      role: "tests",
      files: [{ path: "src/config.test.ts", additions: 1, deletions: 0, finding_lines: [] }],
    });
    expect(screen.getByText("Tests")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /has findings|have findings/ })).not.toBeInTheDocument();
  });
});

// ---- L05 PR Brief: a focus target opens its group (plan step 25f; R-53, R-59, F-07) ----

describe("SmartDiffGroup — focus target", () => {
  const BOILER: SmartDiffGroupData = {
    role: "boilerplate",
    files: [{ path: "pnpm-lock.yaml", additions: 1, deletions: 0, finding_lines: [] }],
  };

  function tree(focus: React.ComponentProps<typeof SmartDiffGroup>["focus"]) {
    return (
      <NextIntlClientProvider locale="en" messages={{ prReview, shell }}>
        <SmartDiffGroup group={BOILER} files={BOILER.files.map((f) => prFile(f.path))} focus={focus} />
      </NextIntlClientProvider>
    );
  }

  it("R-53, R-59 — a default-closed group opens when it holds the focused file", () => {
    render(tree({ path: "pnpm-lock.yaml", line: 2 }));
    expect(screen.getByRole("button", { name: /Boilerplate/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("pnpm-lock.yaml")).toBeInTheDocument();
  });

  it("R-53 — a focus that arrives after mount still opens it; a focus elsewhere does not", () => {
    const view = render(tree({ path: "src/other.ts", line: 1 }));
    const header = screen.getByRole("button", { name: /Boilerplate/ });
    expect(header).toHaveAttribute("aria-expanded", "false");
    view.rerender(tree({ path: "pnpm-lock.yaml", line: 2 }));
    expect(header).toHaveAttribute("aria-expanded", "true");
  });

  it("F-07 — an already handled focus does not reopen the group", () => {
    render(tree({ path: "pnpm-lock.yaml", line: 2, handled: true }));
    expect(screen.getByRole("button", { name: /Boilerplate/ })).toHaveAttribute("aria-expanded", "false");
  });
});
