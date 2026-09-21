import { CHARS_PER_TOKEN } from "./constants";

/**
 * Roughly how many tokens a prompt block weighs.
 *
 * Deliberately an estimate, not a tokenizer call: the exact count depends on
 * the model's vocabulary, the drawer renders several blocks at once, and
 * shipping tiktoken to the browser to put a number next to a collapsed section
 * is not a trade worth making. What the number is FOR is comparison — "the
 * skills block is a third of this prompt" — and ~4 chars/token is accurate
 * enough for that on English prose and markdown.
 *
 * The `~` in the rendered label is not decoration; it is the honest part.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
