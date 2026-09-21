import type { SkillVersion } from "@devdigest/shared";

/**
 * The one-line label for a version row. `skill_versions` stores a body and
 * nothing else — there is no commit message to show — so the body's first
 * non-empty line stands in for one. A heading loses its `#` markers, since the
 * row is a label, not rendered markdown.
 */
export function summarize(body: string): string | null {
  for (const raw of body.split("\n")) {
    const line = raw.trim().replace(/^#+\s*/, "").trim();
    if (line !== "") return line;
  }
  return null;
}

/** One line of a rendered diff. */
export interface DiffLine {
  kind: "add" | "remove" | "same";
  text: string;
}

/**
 * A line diff of `from` against `to`, via the classic LCS table.
 *
 * Bodies here are prompt fragments — tens of lines, not thousands — so the
 * O(n·m) table is the right trade: it is exact, it is ~20 lines, and it costs
 * no dependency. If skill bodies ever grow to the size where this matters, the
 * fix is a real diff library, not a heuristic.
 */
export function diffLines(from: string, to: string): DiffLine[] {
  const a = from.split("\n");
  const b = to.split("\n");
  // lcs[i][j] = length of the longest common subsequence of a[i:] and b[j:].
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push({ kind: "remove", text: a[i]! });
      i++;
    } else {
      out.push({ kind: "add", text: b[j]! });
      j++;
    }
  }
  while (i < a.length) out.push({ kind: "remove", text: a[i++]! });
  while (j < b.length) out.push({ kind: "add", text: b[j++]! });
  return out;
}

/** Newest first. The API already orders them; sorting makes it a property of
 *  the data rather than of the transport. */
export function newestFirst(versions: readonly SkillVersion[]): SkillVersion[] {
  return [...versions].sort((a, b) => b.version - a.version);
}
