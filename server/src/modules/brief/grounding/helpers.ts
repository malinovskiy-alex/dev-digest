/**
 * PR Brief (L05) — grounding the model's answer in known facts (Ring 1).
 *
 * D-18 order: (1) strict-validate the whole answer (R-33, R-38) → (2) keep
 * risk refs whose path is known → (3) drop risks left with no ref (R-31) →
 * (4) keep focus items whose file is known (R-30) → (5) snap lines (R-34,
 * D-13) → (6) caps (R-35). Caps come last, so an invented item never takes a
 * slot. Paths compare by exact string equality — no case folding, no `./`.
 */
import type { BriefFailureCode, ReviewFocusItem, Risk } from '@devdigest/shared';
import { ConfigError } from '../../../platform/errors.js';
import { TimeoutError } from '../../../platform/resilience.js';
import {
  FAILURE_MESSAGE_MAX,
  GENERATION_FAILED_MESSAGE,
  INVALID_OUTPUT_MESSAGE,
  MAX_FOCUS,
  MAX_RISKS,
  STORE_FAILED_MESSAGE,
  SUMMARY_MAX_CHARS,
  TIMEOUT_MESSAGE,
} from '../constants.js';
import { sliceWhole } from '../inputs/helpers.js';
import type { BriefModelAnswer } from '../schema.js';
import type { GroundingContext } from '../types.js';

/** The answer broke R-33; nothing is stored (R-38). */
export class InvalidOutputError extends Error {
  constructor(message = INVALID_OUTPUT_MESSAGE) {
    super(message);
    this.name = 'InvalidOutputError';
  }
}

/** The brief could not be written (`store_failed`). */
export class StoreFailedError extends Error {
  constructor(cause: unknown) {
    super(STORE_FAILED_MESSAGE, { cause });
    this.name = 'StoreFailedError';
  }
}

/**
 * An error thrown by the one model call (or its wall). Only these may show
 * the provider's own message to the user; anything else in a generation — a
 * DB read, collection, the prompt file — gets a fixed text (F-04).
 */
export class ModelCallError extends Error {
  constructor(readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'ModelCallError';
  }
}

// ---------------------------------------------------------------- validation

/**
 * R-33, D-21: every Review focus item has a non-blank `file`, an integer
 * `line ≥ 1` and a non-blank `reason`. One bad item fails the WHOLE answer.
 */
export function validateAnswer(
  data: BriefModelAnswer,
): { ok: true; answer: BriefModelAnswer } | { ok: false } {
  for (const item of data.review_focus) {
    if (typeof item.file !== 'string' || item.file.trim() === '') return { ok: false };
    if (!Number.isInteger(item.line) || item.line < 1) return { ok: false };
    if (typeof item.reason !== 'string' || item.reason.trim() === '') return { ok: false };
  }
  return { ok: true, answer: data };
}

// ---------------------------------------------------------------- refs

const RISK_REF = /^([^:\s][^:]*?)(?::([1-9]\d*)(?:-([1-9]\d*))?)?$/;

/** `<path>`, `<path>:<n>` or `<path>:<a>-<b>` with `a ≤ b` (R-32, D-18); else null. */
export function parseRiskRef(ref: string): { path: string; start?: number; end?: number } | null {
  const m = RISK_REF.exec(ref);
  if (!m) return null;
  const path = m[1]!;
  if (m[2] === undefined) return { path };
  const start = Number(m[2]);
  const end = m[3] === undefined ? start : Number(m[3]);
  if (start > end) return null;
  return { path, start, end };
}

// ---------------------------------------------------------------- snapping

function nearestRangeStart(line: number, ranges: Array<[number, number]>): number {
  let best = ranges[0]!;
  let bestDist = Infinity;
  for (const r of ranges) {
    const dist = line < r[0] ? r[0] - line : line > r[1] ? line - r[1] : 0;
    // strictly smaller: on a tie the earlier range (ranges are ascending) wins
    if (dist < bestDist) {
      best = r;
      bestDist = dist;
    }
  }
  return best[0];
}

function nearestLine(line: number, lines: number[]): number {
  let best = lines[0]!;
  for (const l of lines) if (Math.abs(l - line) < Math.abs(best - line)) best = l;
  return best;
}

/**
 * D-13, R-34: a line is valid inside an added range of its file or on a caller
 * line of its file. Otherwise it moves to the start of the nearest range, else
 * the nearest caller line (ties → earlier); a file with neither keeps its line
 * and is not counted (the client shows "not in the changed lines").
 */
export function snapFocusLine(item: { file: string; line: number }, ctx: GroundingContext): { line: number; moved: boolean } {
  const ranges = ctx.ranges.get(item.file) ?? [];
  const callers = ctx.callerLines.get(item.file) ?? [];
  const inRange = ranges.some(([a, b]) => item.line >= a && item.line <= b);
  if (inRange || callers.includes(item.line)) return { line: item.line, moved: false };
  if (ranges.length > 0) return { line: nearestRangeStart(item.line, ranges), moved: true };
  if (callers.length > 0) return { line: nearestLine(item.line, callers), moved: true };
  return { line: item.line, moved: false };
}

// ---------------------------------------------------------------- grounding

export interface GroundedAnswer {
  summary: string;
  risks: Risk[];
  review_focus: ReviewFocusItem[];
  dropped: { risks: number; risk_refs: number; review_focus: number };
  focusLinesMoved: number;
}

/** D-18 steps 2–6 over an answer that passed `validateAnswer`. */
export function groundAnswer(answer: BriefModelAnswer, ctx: GroundingContext): GroundedAnswer {
  const known = (path: string) => ctx.prPaths.has(path) || ctx.blastPaths.has(path);
  const dropped = { risks: 0, risk_refs: 0, review_focus: 0 };

  const risks: Risk[] = [];
  for (const risk of answer.risks) {
    const refs = risk.file_refs.filter((ref) => {
      const parsed = parseRiskRef(ref);
      return parsed !== null && known(parsed.path);
    });
    dropped.risk_refs += risk.file_refs.length - refs.length;
    if (refs.length === 0) {
      dropped.risks += 1;
      continue;
    }
    risks.push({ ...risk, file_refs: refs });
  }

  const focus = answer.review_focus.filter((item) => {
    if (known(item.file)) return true;
    dropped.review_focus += 1;
    return false;
  });

  // Snapping only the items that survive the cap gives the same stored lines
  // as snapping all of them, and counts only moves a reader can see.
  let focusLinesMoved = 0;
  const review_focus = focus.slice(0, MAX_FOCUS).map((item) => {
    const snapped = snapFocusLine(item, ctx);
    if (snapped.moved) focusLinesMoved += 1;
    return { file: item.file, line: snapped.line, reason: item.reason };
  });

  return {
    summary: sliceWhole(answer.summary, SUMMARY_MAX_CHARS),
    risks: risks.slice(0, MAX_RISKS),
    review_focus,
    dropped,
    focusLinesMoved,
  };
}

// ---------------------------------------------------------------- failures

/** Credentials a provider error text might echo back (F-04). */
const SECRET_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\bsk-[A-Za-z0-9_-]{8,}/g, 'sk-***'],
  [/\bgh[pousr]_[A-Za-z0-9]{16,}/g, 'gh*_***'],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***'],
];

/** One line, at most `max` chars, with key- and token-shaped strings masked. */
function oneLine(text: string, max: number): string {
  let out = text.replace(/\s+/g, ' ').trim();
  for (const [re, mask] of SECRET_PATTERNS) out = out.replace(re, mask);
  return out.slice(0, max);
}

function messageOf(err: unknown): string {
  const e = err as { message?: unknown } | null;
  return typeof e?.message === 'string' ? e.message : String(err);
}

function isTimeout(err: unknown): boolean {
  return err instanceof TimeoutError || (err as { name?: unknown } | null)?.name === 'TimeoutError';
}

/**
 * The stored failure of a generation (R-38, R-60). Only an error of the model
 * call itself (`ModelCallError`) may carry the provider's message — one line,
 * ≤ 300 chars, secrets masked. Any other error gets a fixed text; its cause
 * goes to the server log only (F-04).
 */
export function classifyGenerationError(err: unknown): { code: BriefFailureCode; message: string } {
  if (err instanceof InvalidOutputError) return { code: 'invalid_output', message: INVALID_OUTPUT_MESSAGE };
  if (err instanceof StoreFailedError) return { code: 'store_failed', message: STORE_FAILED_MESSAGE };
  if (err instanceof ModelCallError) {
    const cause = err.cause;
    if (isTimeout(cause)) return { code: 'timeout', message: TIMEOUT_MESSAGE };
    const message = messageOf(cause);
    if (/failed schema|schema validation/i.test(message)) {
      return { code: 'invalid_output', message: INVALID_OUTPUT_MESSAGE };
    }
    if (cause instanceof ConfigError || (cause as { code?: unknown } | null)?.code === 'config_error') {
      return { code: 'no_api_key', message: GENERATION_FAILED_MESSAGE };
    }
    return { code: 'provider_error', message: oneLine(message, FAILURE_MESSAGE_MAX) || 'unknown error' };
  }
  if (isTimeout(err)) return { code: 'timeout', message: TIMEOUT_MESSAGE };
  return { code: 'provider_error', message: GENERATION_FAILED_MESSAGE };
}

/** The real cause of a failed generation, for the server log only (F-04). */
export function failureLogFields(err: unknown): { error: string; error_name: string | null } {
  const inner = err instanceof ModelCallError || err instanceof StoreFailedError ? (err.cause ?? err) : err;
  const name = (inner as { name?: unknown } | null)?.name;
  return { error: oneLine(messageOf(inner), FAILURE_MESSAGE_MAX), error_name: typeof name === 'string' ? name : null };
}

// ---------------------------------------------------------------- deadline

/**
 * F-12: the call's timeout — its own limit (R-73), but never past what is
 * left of the job runner's wall after `elapsedMs`, minus `marginMs` for
 * storing and logging. ≤ 0 means there is no time left for a call.
 */
export function callDeadlineMs(i: { limitMs: number; wallMs: number; marginMs: number; elapsedMs: number }): number {
  return Math.min(i.limitMs, i.wallMs - i.marginMs - i.elapsedMs);
}
