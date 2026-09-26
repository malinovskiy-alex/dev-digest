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
 * Where a snippet was found: 0-based `start`, exclusive `end`, and how many of
 * its anchor lines were actually confirmed there.
 */
interface Located {
  start: number;
  end: number;
  matched: number;
}

/**
 * Try to place the anchor block at `start`.
 *
 * The first anchor must sit exactly on `start`; the rest are then looked for in
 * order within `EVIDENCE_LINE_CAP` lines, and a file line that does not match is
 * stepped over rather than failing the whole attempt. That tolerance is
 * deliberate — a model routinely re-indents or re-spaces the lines it quotes
 * (`{ userId }` → `{userId}`), and `normalise` cannot absorb all of it. What it
 * costs is certainty, which is why `matched` comes back with the position and
 * the caller decides how much corroboration it needs.
 */
function matchFrom(normalised: string[], anchors: string[], start: number): Located | null {
  if (normalised[start] !== anchors[0]) return null;

  let matched = 1;
  let end = start + 1;
  let i = start + 1;
  while (matched < anchors.length && i < normalised.length && i - start <= EVIDENCE_LINE_CAP) {
    if (normalised[i] === anchors[matched]) {
      matched += 1;
      i += 1;
      end = i;
    } else {
      i += 1;
    }
  }
  return { start, end, matched };
}

/**
 * Where the snippet really is, or `null`.
 *
 * The claimed line is a HINT and nothing more, so the search widens in three
 * steps, each less trustworthy than the last:
 *
 *   1. the claimed line;
 *   2. a ±EVIDENCE_LINE_CAP window around it. Steps 1 and 2 accept a
 *      first-line match on its own, because the model's own line number is
 *      already corroborating it;
 *   3. the whole file, corroborated by nothing — and therefore accepted only
 *      when the match cannot be a coincidence: a second anchor line confirms
 *      it, or the snippet occurs exactly once.
 *
 * Step 3 is the one that matters. It used to take the first occurrence of the
 * snippet's FIRST line anywhere in the file, which let `}`, `});` and
 * `import { z } from 'zod';` drag a candidate to the top of the file and store
 * it as verified — a real rule pinned to code that says nothing about it, the
 * exact failure this module exists to prevent. A candidate that only step 3 can
 * place, and place ambiguously, is dropped instead.
 */
function locate(lines: string[], anchors: string[], claimedStart: number): Located | null {
  if (anchors.length === 0) return null;
  const normalised = lines.map(normalise);

  const at = (start: number): Located | null =>
    start < 0 || start >= normalised.length ? null : matchFrom(normalised, anchors, start);

  const claimedIdx = claimedStart - 1;
  const exact = at(claimedIdx);
  if (exact) return exact;

  for (let d = 1; d <= EVIDENCE_LINE_CAP; d += 1) {
    const before = at(claimedIdx - d);
    if (before) return before;
    const after = at(claimedIdx + d);
    if (after) return after;
  }

  // Uncorroborated: a second confirmed anchor line makes a match trustworthy on
  // its own; without one, the snippet has to be unique in the file.
  const hits: Located[] = [];
  for (let i = 0; i < normalised.length; i += 1) {
    const hit = at(i);
    if (!hit) continue;
    if (hit.matched >= 2) return hit;
    hits.push(hit);
    if (hits.length > 1) return null; // ambiguous — guessing is what caused the bug
  }
  return hits[0] ?? null;
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
    const found = locate(sample.lines, anchors, c.evidence_start_line);
    if (!found) continue; // not in the file, or not placeable without guessing

    // The span comes from where the anchors MATCHED, never from the claimed
    // range: line numbers are the field a model gets wrong most often, and the
    // matched region is the part we just proved. When only the first line could
    // be confirmed (a heavily reformatted quote), the snippet's own line count
    // is the floor, so the card still shows the lines the model meant.
    const { start } = found;
    const quoted = c.evidence_snippet.split(/\r?\n/);
    while (quoted.length > 0 && quoted[0]!.trim() === '') quoted.shift();
    while (quoted.length > 0 && quoted[quoted.length - 1]!.trim() === '') quoted.pop();
    const floor = start + Math.min(Math.max(quoted.length, 1), EVIDENCE_LINE_CAP);
    const end = Math.min(Math.max(found.end, floor), sample.lines.length);

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
