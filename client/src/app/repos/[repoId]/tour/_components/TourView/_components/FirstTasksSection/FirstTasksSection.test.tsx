/**
 * FirstTasksSection — model and fallback tasks with kind tag, reason and link,
 * or the no-candidates message (plan step 30b: AC-54, AC-56, AC-57, AC-59).
 * AC-58 (the no-clone payload across all sections) is in TourView.test.tsx.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { TourTask, TourTasks } from "@devdigest/shared";
import onboarding from "../../../../../../../../../messages/en/onboarding.json";
import { FirstTasksSection } from "./FirstTasksSection";

afterEach(cleanup);

const task = (over: Partial<TourTask>): TourTask => ({
  candidate_id: "x",
  kind: "todo",
  source: "fallback",
  title: null,
  reason: null,
  path: null,
  line: null,
  pr_number: null,
  pr_title: null,
  detail: null,
  importers: null,
  top_percent: null,
  ...over,
});

const FALLBACK: TourTask[] = [
  task({ candidate_id: "todo:src/a.ts:12", kind: "todo", path: "src/a.ts", line: 12, detail: "handle the retry case" }),
  task({ candidate_id: "missing-tests:src/b.ts", kind: "missing-tests", path: "src/b.ts", importers: 6, top_percent: 4 }),
  task({ candidate_id: "open-pr:7", kind: "open-pr", pr_number: 7, pr_title: "Fix login", detail: "marisa" }),
];

const renderList = (list: TourTasks) =>
  render(
    <NextIntlClientProvider locale="en" messages={{ onboarding }}>
      <FirstTasksSection list={list} repoFullName="acme/payments-api" revision="abc123" />
    </NextIntlClientProvider>,
  );

describe("FirstTasksSection", () => {
  it("AC-54 — model tasks show their titles and reasons", () => {
    renderList({
      tasks: [
        task({ candidate_id: "todo:src/a.ts:12", source: "model", title: "Make retries idempotent", reason: "a small, well-scoped fix", path: "src/a.ts", line: 12 }),
        task({ candidate_id: "open-pr:7", kind: "open-pr", source: "model", title: "Review the login fix", reason: "learn the auth flow", pr_number: 7, pr_title: "Fix login" }),
        task({ candidate_id: "missing-tests:src/b.ts", kind: "missing-tests", source: "model", title: "Cover the ledger", reason: "untested core", path: "src/b.ts" }),
      ],
      gap: null,
    });
    expect(screen.getByText("Make retries idempotent")).toBeInTheDocument();
    expect(screen.getByText("Review the login fix")).toBeInTheDocument();
    expect(screen.getByText("a small, well-scoped fix")).toBeInTheDocument();
  });

  it("AC-56 — fallback tasks use the fixed title per kind", () => {
    renderList({ tasks: FALLBACK, gap: null });
    expect(screen.getByText("Resolve the TODO in src/a.ts:12")).toBeInTheDocument();
    expect(screen.getByText("Add tests for src/b.ts")).toBeInTheDocument();
    expect(screen.getByText("Review PR #7: Fix login")).toBeInTheDocument();
  });

  it("AC-57 — each task has a kind tag, a reason and a link (#L12 for a TODO, /pull/7 for a PR)", () => {
    renderList({ tasks: FALLBACK, gap: null });
    const [todo, missing, pr] = screen.getAllByRole("listitem");
    expect(within(todo!).getByText("TODO")).toBeInTheDocument();
    expect(within(todo!).getByText("handle the retry case")).toBeInTheDocument();
    expect(within(todo!).getByRole("link")).toHaveAttribute("href", expect.stringMatching(/\/blob\/abc123\/src\/a\.ts#L12$/));

    expect(within(missing!).getByText("Missing tests")).toBeInTheDocument();
    expect(within(missing!).getByText("imported by 6 files · top 4% by rank")).toBeInTheDocument();
    expect(within(missing!).getByRole("link")).toHaveAttribute("href", expect.stringMatching(/\/blob\/abc123\/src\/b\.ts$/));

    expect(within(pr!).getByText("Open PR")).toBeInTheDocument();
    expect(within(pr!).getByText("opened by marisa")).toBeInTheDocument();
    expect(within(pr!).getByRole("link")).toHaveAttribute("href", "https://github.com/acme/payments-api/pull/7");
  });

  it("AC-59 — no_candidates → No starter tasks found in this repository", () => {
    renderList({ tasks: [], gap: "no_candidates" });
    expect(screen.getByText("No starter tasks found in this repository")).toBeInTheDocument();
  });
});
