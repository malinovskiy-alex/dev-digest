/** Pure helpers for the PR Brief's Risk areas list. */
import { RISK_REF_RE } from "./constants";

export interface ParsedRef {
  path: string;
  start: number | null;
  end: number | null;
}

/**
 * Split a risk file ref into path and line range. The server already dropped
 * every ref that does not match (R-32); a ref that still does not is shown
 * whole, as a path with no line.
 */
export function parseRef(ref: string): ParsedRef {
  const m = RISK_REF_RE.exec(ref);
  if (!m) return { path: ref, start: null, end: null };
  const start = m[2] ? Number(m[2]) : null;
  const end = m[3] ? Number(m[3]) : start;
  return { path: m[1]!, start, end };
}

/** The visible line part of a ref: `12-18`, `40`, or undefined when it names no line. */
export function refLabel(ref: ParsedRef): string | undefined {
  if (ref.start == null) return undefined;
  return ref.end != null && ref.end !== ref.start ? `${ref.start}-${ref.end}` : String(ref.start);
}
