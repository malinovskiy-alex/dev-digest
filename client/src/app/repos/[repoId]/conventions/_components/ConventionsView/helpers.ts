import type { ConventionCandidate } from "@devdigest/shared";

/** Pure helpers for the Conventions screen. */

/**
 * "just now" / "12m ago" / "1h ago" / "3d ago" for the scan line.
 *
 * A near-twin of `repos/[repoId]/pulls/helpers.relativeTime`, kept separate on
 * purpose: that one is a compact column value ("3h") and this one is a sentence
 * fragment ("3h ago"). Merging them would make one of the two screens read
 * wrong, and neither is shared enough to earn a `src/lib/` home yet.
 */
export function scanAge(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const m = Math.max(0, Math.round((now - then) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** How many of the candidates are currently accepted. */
export function acceptedCount(candidates: ConventionCandidate[]): number {
  return candidates.filter((c) => c.status === "accepted").length;
}

/**
 * Colour for a confidence bar. The thresholds match `ConfidenceNum` in the
 * design system so the same number never gets two different colours on two
 * screens.
 */
export function confidenceColor(confidence: number): string {
  const pct = confidence * 100;
  if (pct >= 85) return "var(--ok)";
  if (pct >= 65) return "var(--warn)";
  return "var(--text-muted)";
}

/** `src/api/users.ts:23-31`, or `…:23` when the evidence is a single line. */
export function evidenceRef(c: ConventionCandidate): string {
  return c.evidence_start_line === c.evidence_end_line
    ? `${c.evidence_path}:${c.evidence_start_line}`
    : `${c.evidence_path}:${c.evidence_start_line}-${c.evidence_end_line}`;
}
