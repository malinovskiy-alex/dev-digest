// Shared git/diff plumbing for pr-self-review.
// Node builtins only — this runs from a hook, before anything is installed.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Run git, return trimmed stdout. Never throws — a failed git call yields ''. */
export function git(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).replace(/\r\n/g, '\n');
  } catch {
    return '';
  }
}

export function repoRoot() {
  const root = git(['rev-parse', '--show-toplevel']).trim();
  return root || process.cwd();
}

/**
 * origin/main when it exists, else main. Never the local main if the remote one
 * is available: the local branch lags, and then someone else's work lands in
 * our diff.
 */
export function baseRef(root) {
  if (git(['rev-parse', '--verify', '--quiet', 'origin/main'], root).trim()) return 'origin/main';
  if (git(['rev-parse', '--verify', '--quiet', 'main'], root).trim()) return 'main';
  return '';
}

const EXCLUDED = [
  /^server\/clones\//,
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)\.next\//,
  /^\.devdigest\//,
  /(^|\/)coverage\//,
];

export const isExcluded = (p) => EXCLUDED.some((re) => re.test(p));

/** Everything that is open right now: branch commits + staged + unstaged + untracked. */
export function collectDiff(root) {
  const base = baseRef(root);
  const headSha = git(['rev-parse', 'HEAD'], root).trim();
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], root).trim();
  const mb = base ? git(['merge-base', base, 'HEAD'], root).trim() : '';

  const files = new Map();
  const add = (path, patch) => {
    if (isExcluded(path)) return;
    files.set(path, { path, status: 'M', added: 0, deleted: 0, untracked: false, ...files.get(path), ...patch });
  };

  // Tracked: merge-base -> working tree (covers committed, staged and unstaged).
  if (mb) {
    for (const line of git(['diff', '--numstat', mb], root).split('\n').filter(Boolean)) {
      const [a, d, ...rest] = line.split('\t');
      add(rest.join('\t'), { added: Number(a) || 0, deleted: Number(d) || 0 });
    }
    for (const line of git(['diff', '--name-status', mb], root).split('\n').filter(Boolean)) {
      const [status, ...rest] = line.split('\t');
      add(rest[rest.length - 1], { status: status[0] });
    }
  }

  // Untracked files git has never seen — usually exactly what is worth reviewing.
  for (const path of git(['ls-files', '--others', '--exclude-standard'], root).split('\n').filter(Boolean)) {
    if (isExcluded(path)) continue;
    let lines = 0;
    try {
      lines = readFileSync(join(root, path), 'utf8').split('\n').length;
    } catch {
      continue; // binary or unreadable
    }
    add(path, { status: 'A', added: lines, deleted: 0, untracked: true });
  }

  const diffText = mb ? git(['diff', '-U3', mb], root) : '';
  const list = [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
  const diffHash = createHash('sha256')
    .update(diffText)
    .update(list.filter((f) => f.untracked).map((f) => `${f.path}:${f.added}`).join('\n'))
    .digest('hex')
    .slice(0, 16);

  return { base, mergeBase: mb, headSha, branch, files: list, diffText, diffHash, root };
}

/** Added lines with real line numbers, per file. Untracked files count as all-added. */
export function addedLines(d) {
  const out = [];
  let file = null;
  let lineNo = 0;
  for (const raw of d.diffText.split('\n')) {
    if (raw.startsWith('+++ b/')) {
      file = raw.slice(6);
      continue;
    }
    if (raw.startsWith('@@')) {
      const m = /\+(\d+)/.exec(raw);
      lineNo = m ? Number(m[1]) : 0;
      continue;
    }
    if (!file || isExcluded(file)) continue;
    if (raw.startsWith('+') && !raw.startsWith('+++')) out.push({ file, line: lineNo++, text: raw.slice(1) });
    else if (!raw.startsWith('-') && !raw.startsWith('\\')) lineNo++;
  }
  for (const f of d.files.filter((x) => x.untracked)) {
    let text = '';
    try {
      text = readFileSync(join(d.root, f.path), 'utf8');
    } catch {
      continue;
    }
    text.split('\n').forEach((t, i) => out.push({ file: f.path, line: i + 1, text: t }));
  }
  return out;
}

export const cacheDir = (root) => join(root, '.devdigest', 'cache', 'pr-self-review');

export function readJson(path) {
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  } catch {
    return null;
  }
}
