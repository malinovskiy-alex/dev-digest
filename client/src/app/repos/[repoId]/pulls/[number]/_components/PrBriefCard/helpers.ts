/** Pure helpers for the PR Brief block. Each returns message keys + values; the component translates. */
import type { BriefFailure, BriefMissingInput, BriefTrim, PrBriefView } from "@devdigest/shared";
import { ApiError } from "@/lib/api";
import { DEGRADED_PREFIX, KNOWN_MISSING_REASONS, NO_KEY_CODE } from "./constants";

/** A `brief.*` message key with its values. */
export interface Msg {
  key: string;
  values?: Record<string, string | number>;
}

/**
 * Anything removed or cut by the budget, or a moved focus line (R-25, D-25).
 * `input_tokens` is always set and does not count.
 */
export function isTrimmed(trim: BriefTrim): boolean {
  return (
    trim.specs_removed.length > 0 ||
    trim.description !== "kept" ||
    trim.callers_removed > 0 ||
    trim.issue_body !== "kept" ||
    trim.diff_rows_removed > 0 ||
    trim.focus_lines_moved > 0
  );
}

/** One tooltip line per non-zero trim field, in trim order (R-25). */
export function trimLines(trim: BriefTrim): Msg[] {
  const out: Msg[] = [];
  if (trim.specs_removed.length > 0) out.push({ key: "trim.specs", values: { paths: trim.specs_removed.join(", ") } });
  if (trim.description !== "kept") out.push({ key: `trim.description.${trim.description}` });
  if (trim.callers_removed > 0) out.push({ key: "trim.callers", values: { count: trim.callers_removed } });
  if (trim.issue_body !== "kept") out.push({ key: `trim.issue.${trim.issue_body}` });
  if (trim.diff_rows_removed > 0) out.push({ key: "trim.diffRows", values: { count: trim.diff_rows_removed } });
  if (trim.focus_lines_moved > 0) out.push({ key: "trim.focusMoved", values: { count: trim.focus_lines_moved } });
  return out;
}

/**
 * The readable reason of a missing input (R-28): a known code → its label,
 * `degraded:<x>` → the parametrised label, anything else → the raw code
 * (shown, never hidden).
 */
export function missingReason(reason: string): Msg | { raw: string } {
  if ((KNOWN_MISSING_REASONS as readonly string[]).includes(reason)) return { key: `missingReason.${reason}` };
  if (reason.startsWith(DEGRADED_PREFIX)) {
    return { key: "missingReason.degraded", values: { reason: reason.slice(DEGRADED_PREFIX.length) || "unknown" } };
  }
  return { raw: reason };
}

/** The input labels of the "Generated without:" line, in the server's order. */
export function missingItems(list: BriefMissingInput[]): { input: Msg; reason: Msg | { raw: string } }[] {
  return list.map((m) => ({ input: { key: `missing.${m.input}` }, reason: missingReason(m.reason) }));
}

/** The failure to show above a stored brief, unless the user dismissed this one (R-61). */
export function regenerationFailure(
  failure: BriefFailure | null,
  dismissedAt: string | null,
): BriefFailure | null {
  return failure && failure.at !== dismissedAt ? failure : null;
}

/** A start rejected for a missing key (R-39): its server message is shown with the Settings link. */
export function isNoKeyError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.code === NO_KEY_CODE;
}

/** A parseable date for the "Generated …" line, or null. */
export function generatedAt(iso: string): Date | null {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t);
}

/**
 * What a rejected start is judged against (F-13): whether a generation runs,
 * which brief is stored and which failure is recorded. Key availability is
 * left out, so the server's no-key message (R-39) is not hidden by the
 * refetch that follows it.
 */
export function viewSignature(view: PrBriefView | undefined): string {
  if (!view) return "";
  return [view.generating ? "1" : "0", view.brief?.meta.generated_at ?? "", view.last_failure?.at ?? ""].join("|");
}
