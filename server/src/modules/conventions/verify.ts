import type { ConventionCategory } from '@devdigest/shared';
import { EVIDENCE_LINE_CAP, MAX_CANDIDATES, type ExtractedConvention } from './constants.js';
import type { FileSample } from './sampling.js';

/**
 * The evidence gate — the conventions feature's answer to the review path's
 * grounding gate, and the reason a card on this screen can be trusted.
 *
 * A model asked to read a repo will occasionally cite a file it was never
 * shown, a line number off by a hundred, or a snippet it paraphrased into
 * something tidier than the real code. None of those are visible to a reader:
 * a wrong `file:line` under a plausible rule looks exactly like a right one.
 * So nothing is stored on the model's word. For each candidate:
 *
 *   1. the path must be one of the sampled files (the model cannot widen its
 *      own allow-list, and a path it invented has nowhere to resolve);
 *   2. the line range must exist in that sample, be ordered, and be narrow
 *      enough to read on a card;
 *   3. a non-blank line of the quoted snippet must actually appear in the file
 *      — inside the claimed range, or anywhere in it, in which case the range
 *      is CORRECTED rather than the candidate dropped. A right rule with a
 *      drifted line number is the common failure and it is repairable;
 *   4. the stored snippet is then re-read FROM THE FILE. What the card shows is
 *      the repo's own bytes, never the model's copy of them.
 *
 * Everything else is dropped without comment. Duplicate rules collapse to the
 * most confident one, and the survivors come back most-confident first.
 *
 * Pure: samples in, verified candidates out. No DB, no adapter, no container.
 */

/** A candidate that survived the gate, with its evidence corrected to the file. */
export interface VerifiedConvention {
  category: ConventionCategory;
  rule: string;
  evidencePath: string;
  evidenceStartLine: number;
  evidenceEndLine: number;
  evidenceSnippet: string;
  confidence: number;
}

/** Normalised for comparison: whitespace runs collapse, case is ignored. */
function normalise(line: string): string {
  return line.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The snippet's non-blank lines, normalised — what we look for in the file. */
function anchorLines(snippet: string): string[] {
  return snippet
    .split(/\r?\n/)
    .map(normalise)
    .filter((l) => l.length > 0);
}

/**
 * Where the snippet really starts in the file, as a 0-based index, or -1.
 * Prefers the claimed range so an anchor that repeats (a `}` line, an import)
 * does not drag the evidence to the first occurrence in the file.
 */
function locate(lines: string[], anchors: string[], claimedStart: number): number {
  if (anchors.length === 0) return -1;
  const normalised = lines.map(normalise);
  const first = anchors[0]!;

  const claimedIdx = claimedStart - 1;
  if (normalised[claimedIdx] === first) return claimedIdx;

  // A small window around the claim absorbs the usual off-by-a-few drift.
  for (let d = 1; d <= EVIDENCE_LINE_CAP; d += 1) {
    if (normalised[claimedIdx - d] === first) return claimedIdx - d;
    if (normalised[claimedIdx + d] === first) return claimedIdx + d;
  }

  return normalised.indexOf(first);
}

/**
 * Verify a batch against the samples it was extracted from. `samples` is keyed
 * by path — the same list `collectSamples` produced and the prompt showed.
 */
export function verifyCandidates(
  candidates: ExtractedConvention[],
  samples: FileSample[],
): VerifiedConvention[] {
  const byPath = new Map(samples.map((s) => [s.path, s]));
  const verified: VerifiedConvention[] = [];

  for (const c of candidates) {
    const sample = byPath.get(c.evidence_path);
    if (!sample) continue; // cited a file it was never shown

    const anchors = anchorLines(c.evidence_snippet);
    const start = locate(sample.lines, anchors, c.evidence_start_line);
    if (start < 0) continue; // the quoted code is not in the file

    // How MUCH to show is taken from the snippet, not from the claimed range:
    // the line numbers are the field a model gets wrong most often, and the
    // quoted lines are the one part of the answer we just proved. Leading and
    // trailing blanks go first, so the span lines up with what `locate` anchored
    // on.
    const quoted = c.evidence_snippet.split(/\r?\n/);
    while (quoted.length > 0 && quoted[0]!.trim() === '') quoted.shift();
    while (quoted.length > 0 && quoted[quoted.length - 1]!.trim() === '') quoted.pop();
    const span = Math.min(Math.max(quoted.length, 1), EVIDENCE_LINE_CAP);
    const end = Math.min(start + span, sample.lines.length);

    const snippet = sample.lines.slice(start, end).join('\n');
    if (snippet.trim().length === 0) continue;

    verified.push({
      category: c.category,
      rule: c.rule.trim(),
      evidencePath: c.evidence_path,
      evidenceStartLine: start + 1,
      evidenceEndLine: end,
      evidenceSnippet: snippet,
      confidence: c.confidence,
    });
  }

  return dedupe(verified).slice(0, MAX_CANDIDATES);
}

/** One row per rule: the same rule twice keeps the more confident evidence. */
function dedupe(rows: VerifiedConvention[]): VerifiedConvention[] {
  const best = new Map<string, VerifiedConvention>();
  for (const row of rows) {
    const key = normalise(row.rule);
    const seen = best.get(key);
    if (!seen || row.confidence > seen.confidence) best.set(key, row);
  }
  return [...best.values()].sort((a, b) => b.confidence - a.confidence);
}
