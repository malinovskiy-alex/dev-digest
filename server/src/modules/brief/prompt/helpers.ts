/**
 * PR Brief (L05) — the user message and the 8,000-token budget (Ring 1).
 *
 *   renderSections → the D-23 sections, in a fixed order; every value that
 *                    came from an author, a model or the repo is inside
 *                    `wrapUntrusted` (R-37, D-22). No keyword scanning.
 *   fitBudget      → the D-24 trim loop: specs → description → callers →
 *                    issue body → diff rows. Re-measures the WHOLE input after
 *                    every cut and never throws (R-19 … R-24). The PR title is
 *                    never cut (D-37).
 *
 * Nothing here reads a patch: rows carry numeric ranges only (INV-9). The same
 * facts give byte-identical output (R-26): no ids, no timestamps.
 */
import { sectionMeta, wrapUntrusted, type PromptSectionMeta } from '@devdigest/reviewer-core';
import type { BriefCut, BriefMissingInput, BriefTrim, Intent } from '@devdigest/shared';
import { CHARS_PER_TOKEN, INPUT_BUDGET_CHARS, TRUNCATED_MARKER } from '../constants.js';
import { comparePaths, formatRanges, sliceWhole } from '../inputs/helpers.js';
import type { BriefCaller, BriefFacts, BriefIssue, BriefSpec, DiffRow } from '../types.js';

/** One rendered section of the user message. `text` ends with its own `\n\n` (D-20). */
export interface PromptSection {
  name: string;
  trust: 'trusted' | 'untrusted';
  text: string;
}

const SEP = '\n\n';
const SOURCE = 'brief';

/** What one rendering draws from — the facts after any trim. */
interface PromptView {
  title: string;
  intent: Intent | null;
  missing: BriefMissingInput[];
  rows: DiffRow[];
  /** null → no blast-radius block (missing input). */
  blastSummary: string | null;
  callers: BriefCaller[];
  /** null → no description block (missing, or dropped by the budget). */
  description: string | null;
  issue: BriefIssue | null;
  specs: BriefSpec[];
}

function missingLine(missing: BriefMissingInput[]): string {
  if (missing.length === 0) return 'none';
  return missing.map((m) => `${m.input} (${m.reason})`).join(', ');
}

function bulletList(items: string[]): string {
  return items.length === 0 ? '(none)' : items.map((i) => `- ${i}`).join('\n');
}

function intentText(intent: Intent): string {
  return [
    `Intent: ${intent.intent}`,
    `Kind: ${intent.kind ?? 'unknown'}`,
    `In scope:\n${bulletList(intent.in_scope)}`,
    `Out of scope:\n${bulletList(intent.out_of_scope)}`,
    `Risk areas:\n${bulletList(intent.risk_areas)}`,
  ].join('\n');
}

function rowText(r: DiffRow): string {
  return `${r.path} | ${r.role} | +${r.additions} -${r.deletions} | lines: ${formatRanges(r.ranges)}`;
}

function callerText(c: BriefCaller): string {
  return `${c.name} — ${c.file}:${c.line}`;
}

function issueText(issue: BriefIssue): string {
  return issue.body === '' ? issue.title : `${issue.title}${SEP}${issue.body}`;
}

function untrusted(name: string, label: string, text: string): PromptSection {
  return { name, trust: 'untrusted', text: wrapUntrusted(label, text) + SEP };
}

/** The D-23 sections of one view, in order. An omitted input leaves no block. */
function renderView(v: PromptView): PromptSection[] {
  const out: PromptSection[] = [
    {
      name: 'header',
      trust: 'trusted',
      text: `Facts about this pull request follow. Missing inputs: ${missingLine(v.missing)}${SEP}`,
    },
    untrusted('pr-title', 'pr-title', v.title),
  ];
  if (v.intent) out.push(untrusted('intent', 'intent', intentText(v.intent)));
  if (v.rows.length > 0) out.push(untrusted('changed-files', 'changed-files', v.rows.map(rowText).join('\n')));
  if (v.blastSummary !== null) {
    out.push(untrusted('blast-radius', 'blast-radius', [v.blastSummary, ...v.callers.map(callerText)].join('\n')));
  }
  if (v.description !== null) out.push(untrusted('pr-description', 'pr-description', v.description));
  if (v.issue) out.push(untrusted('linked-issue', `linked-issue #${v.issue.number}`, issueText(v.issue)));
  for (const s of v.specs) out.push(untrusted(`spec:${s.path}`, `spec:${s.path}`, s.text));
  out.push({ name: 'footer', trust: 'trusted', text: `Answer with the JSON object only.${SEP}` });
  return out;
}

function viewOf(facts: BriefFacts): PromptView {
  const blastMissing = facts.missing.some((m) => m.input === 'blast');
  return {
    title: facts.title,
    intent: facts.intent,
    missing: facts.missing,
    rows: facts.rows,
    blastSummary: facts.blast && !blastMissing ? facts.blast.summary : null,
    callers: facts.blast && !blastMissing ? facts.callers : [],
    description: facts.description === '' ? null : facts.description,
    issue: facts.issue,
    specs: facts.specs,
  };
}

/** The untrimmed sections of a set of facts (D-23). */
export function renderSections(facts: BriefFacts): PromptSection[] {
  return renderView(viewOf(facts));
}

function joinSections(sections: PromptSection[]): string {
  return sections.map((s) => s.text).join('');
}

/**
 * The smallest cut `j` in `0..n` whose total fits, given that the total never
 * grows as `j` grows; `n` when nothing fits. Equivalent to "remove one item at
 * a time and re-measure the whole input" (D-24), in O(log n) renders — a PR
 * with thousands of callers stays cheap.
 */
function smallestFittingCut(n: number, totalAt: (j: number) => number, budget: number): number {
  if (n === 0 || totalAt(0) <= budget) return 0;
  let lo = 1;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (totalAt(mid) <= budget) hi = mid;
    else lo = mid + 1;
  }
  // `lo === n` either fits or nothing does — both mean "cut all n".
  return lo;
}

/**
 * Cut one text to the room left (D-24 steps 2 and 4). `totalWith(t)` measures
 * the whole input with the text replaced by `t` (`''` = block present, empty).
 * If `wrapUntrusted` escaping still overflows, the room shrinks by the
 * overflow and the cut repeats.
 */
function fitText(
  text: string,
  totalWith: (t: string) => number,
  budget: number,
): { text: string | null; cut: BriefCut } {
  if (totalWith(text) <= budget) return { text, cut: 'kept' };
  let room = budget - totalWith('') - TRUNCATED_MARKER.length;
  while (room > 0) {
    const candidate = sliceWhole(text, room) + TRUNCATED_MARKER;
    const over = totalWith(candidate) - budget;
    if (over <= 0) return { text: candidate, cut: 'truncated' };
    room -= over;
  }
  return { text: null, cut: 'dropped' };
}

export interface FittedPrompt {
  /** The user message: the sections joined. */
  user: string;
  sections: PromptSection[];
  trim: Omit<BriefTrim, 'focus_lines_moved'>;
}

/**
 * The D-24 trim loop. Compares `systemChars + user.length` with
 * `INPUT_BUDGET_CHARS` after every cut, in the order of R-20 … R-24. Never
 * throws: if everything droppable is gone and it is still over, the input is
 * sent as is and `input_tokens` shows it (plan R-6).
 */
export function fitBudget(facts: BriefFacts, systemChars: number): FittedPrompt {
  const budget = INPUT_BUDGET_CHARS;
  let v = viewOf(facts);
  const total = (view: PromptView) => systemChars + joinSections(renderView(view)).length;

  // (1) specs — drop the LAST spec while over (R-20).
  const specs = v.specs;
  const specCut = smallestFittingCut(specs.length, (j) => total({ ...v, specs: specs.slice(0, specs.length - j) }), budget);
  const specsDropped = specs.slice(specs.length - specCut).map((s) => s.path);
  v = { ...v, specs: specs.slice(0, specs.length - specCut) };

  // (2) description — cut to the room left, else drop the block (R-21).
  let description: BriefCut = 'kept';
  if (v.description !== null) {
    const base = v;
    const fitted = fitText(base.description!, (t) => total({ ...base, description: t }), budget);
    description = fitted.cut;
    v = { ...v, description: fitted.text };
  }

  // (3) blast-radius callers — remove the LAST caller while over (R-22).
  const callers = v.callers;
  const callerCut = smallestFittingCut(
    callers.length,
    (j) => total({ ...v, callers: callers.slice(0, callers.length - j) }),
    budget,
  );
  v = { ...v, callers: callers.slice(0, callers.length - callerCut) };

  // (4) issue body — like the description; the issue title stays (R-24).
  let issueBody: BriefCut = 'kept';
  if (v.issue && v.issue.body !== '') {
    const base = v;
    const issue = base.issue!;
    const fitted = fitText(issue.body, (t) => total({ ...base, issue: { ...issue, body: t } }), budget);
    issueBody = fitted.cut;
    v = { ...v, issue: { ...issue, body: fitted.text ?? '' } };
  }

  // (5) diff rows — remove the row with the fewest additions + deletions;
  // ties by path DESCENDING, so the earlier path survives (R-24).
  const removalOrder = [...v.rows].sort(
    (a, b) => a.additions + a.deletions - (b.additions + b.deletions) || comparePaths(b.path, a.path),
  );
  const rows = v.rows;
  const keepRows = (j: number) => {
    const gone = new Set(removalOrder.slice(0, j).map((r) => r.path));
    return rows.filter((r) => !gone.has(r.path));
  };
  const rowCut = smallestFittingCut(rows.length, (j) => total({ ...v, rows: keepRows(j) }), budget);
  v = { ...v, rows: keepRows(rowCut) };

  const sections = renderView(v);
  const user = joinSections(sections);
  return {
    user,
    sections,
    trim: {
      specs_removed: [...facts.specsBudgetSkipped, ...specsDropped],
      description,
      callers_removed: callerCut,
      issue_body: issueBody,
      diff_rows_removed: rowCut,
      input_tokens: Math.ceil((systemChars + user.length) / CHARS_PER_TOKEN),
    },
  };
}

/** The sections as the prompt log describes them — sizes and fingerprints, never text (D-20). */
export function toSectionMeta(sections: PromptSection[]): PromptSectionMeta[] {
  return sections.map((s) => sectionMeta(s.name, SOURCE, s.trust, s.text));
}
