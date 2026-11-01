/** Pure helpers for the run-locally section. */

/** One piece of a command comment: plain text, or a backtick span shown as code. */
export interface CommentPart {
  text: string;
  code: boolean;
}

/**
 * Splits a comment on its backtick spans (`like this`) so they render as
 * inline code instead of literal backticks (F-44). Text only — nothing is
 * parsed as markdown or HTML; an unpaired backtick stays as it is.
 */
export function commentParts(comment: string): CommentPart[] {
  const parts: CommentPart[] = [];
  let at = 0;
  for (const m of comment.matchAll(/`([^`\n]+)`/g)) {
    const start = m.index ?? 0;
    if (start > at) parts.push({ text: comment.slice(at, start), code: false });
    parts.push({ text: m[1]!, code: true });
    at = start + m[0].length;
  }
  if (at < comment.length) parts.push({ text: comment.slice(at), code: false });
  return parts;
}
