/** Pure helpers for the tour header. */
import type { OnboardingTour, TourFailureCode } from "@devdigest/shared";

/**
 * The dismissible "Regeneration failed" notice: a failure while a stored tour
 * is shown (AC-73), unless the user dismissed this very failure (D-32).
 */
export function regenerationNotice(
  tour: OnboardingTour,
  dismissedAt: string | null,
): { code: TourFailureCode; message: string; at: string } | null {
  const f = tour.generation.failure;
  if (!f || tour.status !== "generated" || tour.generation.running || f.at === dismissedAt) return null;
  return { code: f.code, message: f.message, at: f.at };
}

/**
 * Which tooltip explains a disabled Generate button: the first blocker wins,
 * in the server's order (AC-14, AC-86). `null` while a generation runs.
 */
export function disabledReason(tour: OnboardingTour): "notCloned" | "indexNotReady" | "noKey" | null {
  if (tour.generation.running) return null;
  const first = tour.blockers[0];
  if (first === "not_cloned") return "notCloned";
  if (first === "index_not_ready") return "indexNotReady";
  if (first === "no_api_key") return "noKey";
  return null;
}

/** The share link for a tour (AC-75). */
export function shareUrl(origin: string, repoId: string): string {
  return `${origin}/repos/${repoId}/tour`;
}

/** One status line under the header, in display order (D-41). */
export type StatusLine =
  | { kind: "not_cloned" }
  | { kind: "index_not_ready" }
  | { kind: "no_api_key"; provider: string }
  | { kind: "failed"; code: TourFailureCode; message: string };

/**
 * One line per blocker, in the server's order (AC-14, AC-15, AC-86), then the
 * failure line when there is no stored tour to fall back on (AC-71). A
 * `no_api_key` failure is not repeated when the `no_api_key` blocker already
 * shows (AC-70).
 */
export function statusLines(tour: OnboardingTour): StatusLine[] {
  const lines: StatusLine[] = tour.blockers.map((b): StatusLine => {
    if (b === "not_cloned") return { kind: "not_cloned" };
    if (b === "index_not_ready") return { kind: "index_not_ready" };
    return { kind: "no_api_key", provider: tour.api_key.provider };
  });
  const failure = tour.generation.failure;
  if (failure && tour.status !== "generated" && !tour.generation.running) {
    const duplicate = failure.code === "no_api_key" && tour.blockers.includes("no_api_key");
    if (!duplicate) lines.push({ kind: "failed", code: failure.code, message: failure.message });
  }
  return lines;
}
