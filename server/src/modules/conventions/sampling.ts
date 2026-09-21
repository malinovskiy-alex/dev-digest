import {
  CONFIG_PROBE_PATHS,
  SAMPLE_CHAR_CAP,
  SAMPLE_LINE_CAP,
} from './constants.js';

/**
 * Sample selection for the conventions extractor — **code only, no model**.
 *
 * This is the half of the feature that decides what the model is allowed to
 * look at, and therefore what it is allowed to cite: `verify.ts` rejects any
 * candidate whose `evidence_path` is not one of the paths collected here. A
 * model call to *choose* the files would put that allow-list under the model's
 * control and there would be nothing left to check it against.
 *
 * Pure by construction: the caller passes a `readFile`, so this module needs no
 * git adapter, no clone path and no container — and a unit test needs no repo.
 */

/** Reads one repo-relative path, or resolves `null` when it is not there. */
export type ReadRepoFile = (path: string) => Promise<string | null>;

export interface FileSample {
  path: string;
  /** Kept whole lines, 1-based — `lines[0]` is line 1 of the real file. */
  lines: string[];
  /** True when the excerpt stops short of the file's end. */
  truncated: boolean;
}

/**
 * Cut a file down to a sample: at most `SAMPLE_LINE_CAP` lines and
 * `SAMPLE_CHAR_CAP` characters, always whole lines so a cited line number still
 * means what it says.
 */
export function toSample(path: string, content: string): FileSample {
  const all = content.split(/\r?\n/);
  const lines: string[] = [];
  let chars = 0;
  for (const line of all) {
    if (lines.length >= SAMPLE_LINE_CAP) break;
    if (chars + line.length > SAMPLE_CHAR_CAP && lines.length > 0) break;
    lines.push(line);
    chars += line.length + 1;
  }
  return { path, lines, truncated: lines.length < all.length };
}

/**
 * Collect the scan's samples: the config/house-rules files that exist, then the
 * top-ranked source files repo-intel picked. Order matters — the prompt shows
 * config first, because a stated rule outranks an inferred one.
 *
 * A file that cannot be read is skipped, not fatal: a repo missing every config
 * file still scans on its sources, and an unindexed repo (no ranked paths) still
 * scans on its configs. Only the empty result is an error, and the caller raises
 * it.
 */
export async function collectSamples(
  readFile: ReadRepoFile,
  rankedPaths: string[],
): Promise<FileSample[]> {
  const samples: FileSample[] = [];
  const seen = new Set<string>();

  for (const path of [...CONFIG_PROBE_PATHS, ...rankedPaths]) {
    if (seen.has(path)) continue;
    seen.add(path);
    const content = await readFile(path);
    if (content == null || content.trim().length === 0) continue;
    samples.push(toSample(path, content));
  }

  return samples;
}

/**
 * Render the samples as the user message's evidence block: every line prefixed
 * with its real 1-based number, so the model can cite `file:line` and `verify.ts`
 * can check the citation against the same numbering.
 *
 * The caller wraps this in `<untrusted source="repo">` — a repo may contain a
 * file that tells the model what "convention" to report, and the delimiters plus
 * the path allow-list are what keep that from becoming a rule.
 */
export function renderSamples(samples: FileSample[]): string {
  return samples
    .map((s) => {
      const width = String(s.lines.length).length;
      const body = s.lines
        .map((line, i) => `${String(i + 1).padStart(width, ' ')} | ${line}`)
        .join('\n');
      const tail = s.truncated ? '\n… (excerpt truncated)' : '';
      return `--- ${s.path} ---\n${body}${tail}`;
    })
    .join('\n\n');
}
