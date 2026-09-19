/**
 * Finding formatting shared by the two surfaces that show one: the PR detail
 * page's FindingCard, and the PR list's hover preview. It lives here rather
 * than in either component's folder so neither has to deep-import past the
 * other's index.ts.
 */
import type { FindingRecord } from "@devdigest/shared";

/** Format a finding's line range ("11" when single-line, else "11-15"). */
export function lineLabel(f: Pick<FindingRecord, "start_line" | "end_line">): string {
  return f.start_line === f.end_line ? `${f.start_line}` : `${f.start_line}-${f.end_line}`;
}

/** Longer than this and a hover preview stops being a glance. */
export const RATIONALE_PREVIEW_CHARS = 150;

/**
 * Flatten a finding's markdown rationale into one line of plain text.
 *
 * There is no plain `description` column — `rationale` is markdown — so a
 * preview has to strip it rather than render it: <Markdown> emits block
 * elements, which is far too heavy for two clamped lines in a popover.
 *
 * Lossy on purpose. A rationale that is mostly a fenced code block previews
 * as whatever prose surrounds it, which is the useful half anyway.
 */
export function shortRationale(md: string, max = RATIONALE_PREVIEW_CHARS): string {
  const flat = md
    .replace(/```[\s\S]*?```/g, " ") // fenced blocks
    .replace(/`([^`]*)`/g, "$1") // inline code
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links / images → their text
    .replace(/[*~]/g, "") // bold / italic / strikethrough markers
    // Only at the start of a line: a lone `#` or `>` mid-sentence is prose.
    // Underscores are left alone on purpose — stripping them would turn
    // `sk_live_` into `sklive`, and identifiers are most of what findings name.
    .replace(/^[>#\s]+/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
