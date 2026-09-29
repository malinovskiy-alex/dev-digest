#!/usr/bin/env node
// PreToolUse guard for the READ-ONLY agents (researcher, architecture-reviewer,
// plan-verifier). They keep Bash because their job is to RUN checks — `pnpm
// arch`, `pnpm test`, `git diff` — but `tools:` cannot scope Bash to a command
// list: a specifier in `disallowedTools` removes the whole tool. So each of
// those agents wires this script as its own frontmatter `hooks:` entry, and it
// fires only while that agent runs, never in the main session.
//
// Allowlist, not denylist: every segment of the command (split on ; && || | and
// newlines) must be a known read-only command, and nothing may be redirected
// into a file. Anything unknown is refused with the reason, so a legitimate new
// need shows up as a visible denial instead of a silent write.
//
// Known limit: an allowed tool can still write as a side effect of its own
// (pnpm 12 drops a placeholder pnpm-workspace.yaml next to package.json). This
// guard stops the agent from writing; it cannot stop a tool from doing so.

const READ_ONLY_GIT = new Set([
  'diff', 'log', 'show', 'status', 'ls-files', 'ls-tree', 'merge-base', 'rev-parse',
  'grep', 'blame', 'cat-file', 'shortlog', 'describe', 'name-rev', 'for-each-ref',
]);
// pnpm/npm scripts that only read: the checks the agents are there to run.
const READ_ONLY_SCRIPTS = new Set(['arch', 'arch:all', 'typecheck', 'test', 'lint']);
const READ_ONLY_TOOLS = new Set([
  'ls', 'cat', 'head', 'tail', 'wc', 'grep', 'rg', 'sort', 'uniq', 'diff', 'cmp', 'echo',
  'printf', 'pwd', 'which', 'date', 'cut', 'tr', 'basename', 'dirname', 'realpath', 'jq',
  'file', 'stat', 'du', 'true', 'false', 'test', '[', 'cd', 'type', 'column', 'nl', 'paste',
]);
// Packages that are npm projects: running pnpm inside them installs and writes
// a pnpm-lock.yaml (it happened — see reviewer-core, 2026-09-27).
const NPM_PACKAGES = /(^|[\\/])(reviewer-core|e2e)([\\/]|$)/;
// node -e is allowed for counting and parsing, never for writing or spawning.
// No trailing \b: `writeFileSync` must match `writeFile` as well.
const NODE_WRITE_API =
  /\b(writeFile|appendFile|createWriteStream|rmSync|rmdir|unlink|mkdir|rename|copyFile|cpSync|cp\(|truncate|symlink|chmod|chown|child_process|execSync|execFile|spawn|fork)/;

const deny = (reason) => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `Read-only agent: ${reason}. This agent may only read and run checks (git read commands, pnpm/npm arch|typecheck|test|lint, ls/cat/grep/…). Report what you would change instead of changing it.`,
      },
    }),
  );
  process.exit(0);
};
const allow = () => process.exit(0);

let stdin = '';
for await (const chunk of process.stdin) stdin += chunk;
let payload;
try {
  payload = JSON.parse(stdin || '{}');
} catch {
  deny('the hook could not read the tool call');
}
const cmd = String(payload?.tool_input?.command ?? '');
const cwd = String(payload?.cwd ?? '');
if (!cmd.trim()) allow();

/** Blank out quoted strings so their contents never look like syntax. */
function unquoted(s) {
  return s.replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

const bare = unquoted(cmd);

// 1. No redirect into a file. Harmless forms are removed first: 2>&1, >&2,
//    anything into /dev/null. `=>` and `>=` inside quotes are already blanked.
const redirects = bare
  .replace(/\d?>&\d/g, '')
  .replace(/&?\d?>>?\s*\/dev\/null/g, '');
if (/>/.test(redirects)) deny('output redirection (> or >>) writes a file');
if (/(^|[\s|])tee(\s|$)/.test(bare)) deny('`tee` writes a file');

// 2. Every segment must be read-only. Split the unquoted text, but keep the
//    original segment for checks that need the quoted content (node -e).
let dir = cwd;
const segments = bare.split(/&&|\|\||[;|\n]/).map((s) => s.trim()).filter(Boolean);
for (const seg of segments) {
  const words = seg.replace(/^(\w+=\S*\s+)+/, '').split(/\s+/);
  const [bin = '', sub = '', third = ''] = words;
  const name = bin.split(/[\\/]/).pop();

  if (name === 'cd') {
    dir = sub;
    continue;
  }
  if (READ_ONLY_TOOLS.has(name)) continue;
  if (name === 'sed') {
    if (/(^|\s)-[a-zA-Z]*i/.test(seg) || /--in-place/.test(seg)) deny('`sed -i` edits a file');
    continue;
  }
  if (name === 'awk') continue; // its only way to write is `>`, refused above
  if (name === 'find') {
    if (/-(delete|exec|execdir|ok|fprint)/.test(seg)) deny('`find` with -delete/-exec can modify files');
    continue;
  }
  if (name === 'git') {
    if (!READ_ONLY_GIT.has(sub)) deny(`\`git ${sub}\` is not a read-only git command`);
    continue;
  }
  if (name === 'pnpm' || name === 'npm') {
    if (name === 'pnpm' && (NPM_PACKAGES.test(dir) || NPM_PACKAGES.test(cwd))) {
      deny('reviewer-core/ and e2e/ are npm projects — pnpm there installs and writes a lockfile; use `npm run …`');
    }
    const script = sub === 'run' ? third : sub;
    if (READ_ONLY_SCRIPTS.has(script)) continue;
    if (sub === 'exec' && ['vitest', 'tsc', 'depcruise'].includes(third)) continue;
    if (name === 'pnpm' && sub === '--version') continue;
    deny(`\`${name} ${sub}${third ? ' ' + third : ''}\` is not one of the read-only checks`);
  }
  if (name === 'npx' && ['vitest', 'tsc'].includes(sub)) continue;
  if (name === 'node') {
    if (sub === '--version' || sub === '-v') continue;
    if (sub === '-e' || sub === '--eval' || sub === '-p') {
      // Check the ORIGINAL command text: the script is inside the quotes.
      if (NODE_WRITE_API.test(cmd)) deny('`node -e` may read and count, but not write files or spawn processes');
      continue;
    }
    deny('`node <file>` runs arbitrary code; use `node -e` for read-only counting');
  }
  if (name === 'claude' && sub === 'plugin' && third === 'validate') continue;
  deny(`\`${name}\` is not on the read-only allowlist`);
}

allow();
