/** Pure helpers for the first-tasks section: which message, which link. */
import type { TourTask } from "@devdigest/shared";
import { githubBlobUrl, githubPrUrl } from "@/lib/github-urls";

/** A message key under the `onboarding` namespace and its values. */
export type Msg = { key: string; values: Record<string, string | number> };

/** The model's title, or the fixed fallback title per kind (AC-56, D-19). */
export function taskTitle(task: TourTask): { text: string } | Msg {
  if (task.source === "model" && task.title) return { text: task.title };
  if (task.kind === "todo") return { key: "tasks.fallback.todo", values: { path: task.path ?? "", line: task.line ?? 0 } };
  if (task.kind === "missing-tests") return { key: "tasks.fallback.missingTests", values: { path: task.path ?? "" } };
  return { key: "tasks.fallback.openPr", values: { n: task.pr_number ?? 0, title: task.pr_title ?? "" } };
}

/** The model's reason, or the deterministic one: TODO text, index reason, PR author (AC-57). */
export function taskReason(task: TourTask): { text: string } | Msg | null {
  if (task.source === "model" && task.reason) return { text: task.reason };
  if (task.kind === "todo") return task.detail ? { text: task.detail } : null;
  if (task.kind === "missing-tests") {
    return task.importers !== null && task.top_percent !== null
      ? { key: "reason.index", values: { importers: task.importers, top: task.top_percent } }
      : null;
  }
  return task.detail ? { key: "tasks.openedBy", values: { author: task.detail } } : null;
}

/** A file at its line at the tour revision, or the PR (AC-57). */
export function taskHref(task: TourTask, repoFullName: string, revision: string | null): string | null {
  if (task.kind === "open-pr") return task.pr_number !== null ? githubPrUrl(repoFullName, task.pr_number) : null;
  if (!task.path || !revision) return null;
  return githubBlobUrl(repoFullName, revision, task.path, task.line ?? undefined);
}
