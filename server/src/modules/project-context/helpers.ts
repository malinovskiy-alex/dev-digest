import type { ContextDoc } from '@devdigest/shared';
import { docCategory } from '../_shared/context-docs/helpers.js';
import { MAX_CONTEXT_DOC_CHARS, MAX_CONTEXT_TOTAL_CHARS } from './constants.js';

/**
 * project-context — pure helpers (Ring 1). No git, no DB: the service hands
 * these already-read values.
 */

/** What a document costs in a prompt: `ceil(min(chars, 32000) / 4)` (D-6). */
export function approxTokens(chars: number): number {
  return Math.ceil(Math.min(chars, MAX_CONTEXT_DOC_CHARS) / 4);
}

/** One listing row. `name`/`folder` split on the last `/`; `folder` is '' at the root. */
export function toContextDoc(path: string, chars: number, usedBy: number): ContextDoc {
  const slash = path.lastIndexOf('/');
  return {
    path,
    name: slash >= 0 ? path.slice(slash + 1) : path,
    folder: slash >= 0 ? path.slice(0, slash) : '',
    category: docCategory(path),
    chars,
    approx_tokens: approxTokens(chars),
    truncated: chars > MAX_CONTEXT_DOC_CHARS,
    used_by: usedBy,
  };
}

/**
 * Cut a document to the prompt limit with a visible marker (D-5). The cut is
 * by UTF-16 code unit, so it can split a surrogate pair at the boundary
 * (plan R-4: harmless to the model, not handled).
 */
export function truncateForPrompt(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_CONTEXT_DOC_CHARS) return { text, truncated: false };
  const cut = text.slice(0, MAX_CONTEXT_DOC_CHARS);
  const marker = `[truncated: first ${MAX_CONTEXT_DOC_CHARS.toLocaleString('en-US')} of ${text.length.toLocaleString('en-US')} characters]`;
  return { text: `${cut}\n\n${marker}`, truncated: true };
}

/** The document refs of one agent, before dedup (the agents repository's shape). */
export interface PromptDocRefs {
  agent: string[];
  skills: { skillName: string; paths: string[] }[];
}

/** One document in prompt order, with where it came from. */
export interface MergedPromptDoc {
  path: string;
  /** `'agent'` for a direct attachment, else the skill's name. */
  via: string;
}

/**
 * The prompt order (R-46, R-47): the agent's own documents first, then each
 * skill's in the skill's order on the agent. A path appears once — its first
 * occurrence wins.
 */
export function mergePromptDocs(refs: PromptDocRefs): MergedPromptDoc[] {
  const seen = new Set<string>();
  const out: MergedPromptDoc[] = [];
  const push = (path: string, via: string) => {
    if (seen.has(path)) return;
    seen.add(path);
    out.push({ path, via });
  };
  for (const path of refs.agent) push(path, 'agent');
  for (const skill of refs.skills) for (const path of skill.paths) push(path, skill.skillName);
  return out;
}

/**
 * Characters of a resolved document that count against the section budget:
 * the document text after the R-52 cut, WITHOUT the `[truncated: …]` marker
 * (decision F-29) — so four documents cut to 32,000 characters fit 128,000.
 */
export function budgetChars(doc: { chars: number }): number {
  return Math.min(doc.chars, MAX_CONTEXT_DOC_CHARS);
}

/**
 * The section budget (R-73): keep documents in the given (R-46) order while
 * the running total of `size(doc)` (default `text.length`; the service passes
 * `budgetChars`) stays within `budget`; the first one
 * that does not fit and every one after it go to `over`. Stopping at the first
 * misfit — rather than squeezing in a smaller later doc — keeps the prompt
 * order meaningful: a later document never displaces an earlier one.
 */
export function applyPromptBudget<T extends { text: string }>(
  docs: T[],
  budget: number = MAX_CONTEXT_TOTAL_CHARS,
  size: (doc: T) => number = (doc) => doc.text.length,
): { kept: T[]; over: T[] } {
  let used = 0;
  for (let i = 0; i < docs.length; i++) {
    used += size(docs[i]!);
    if (used > budget) return { kept: docs.slice(0, i), over: docs.slice(i) };
  }
  return { kept: docs, over: [] };
}
