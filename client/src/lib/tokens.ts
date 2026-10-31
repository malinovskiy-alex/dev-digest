/* lib/tokens.ts — the one token estimate the UI shows, shared by the run trace
   drawer's prompt blocks and the Project Context tabs. */

/**
 * Characters per token. ~4 is the usual rule of thumb for English text under a
 * BPE vocabulary; see `estimateTokens` for why this is an estimate at all.
 */
export const CHARS_PER_TOKEN = 4;

/**
 * Roughly how many tokens a piece of prompt text weighs.
 *
 * Deliberately an estimate, not a tokenizer call: the exact count depends on
 * the model's vocabulary, the drawer renders several blocks at once, and
 * shipping tiktoken to the browser to put a number next to a collapsed section
 * is not a trade worth making. What the number is FOR is comparison — "the
 * skills block is a third of this prompt" — and ~4 chars/token is accurate
 * enough for that on English prose and markdown. The server computes the same
 * `ceil(chars / 4)` for a project-context document's `approx_tokens`.
 *
 * The `~` in the rendered label is not decoration; it is the honest part.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
