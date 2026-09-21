import type { ConventionCandidate, ConventionSkillDraft } from '@devdigest/shared';

/**
 * Accepted candidates → the skill a user is about to save.
 *
 * The model proposes rules; **code** writes the skill. Asking the model for the
 * body too would put a second, unverified generation between the evidence and
 * the prompt an agent eventually reads — and the whole point of the evidence
 * gate is that every line under a rule came out of the repo. So this is a
 * deterministic rendering, and the create-skill modal is a full editor over it:
 * what the user reads there is exactly what is stored.
 *
 * Pure. No DB, no model, no container.
 */

/** The skill type every extracted rule-set gets. */
const DRAFT_TYPE = 'convention' as const;

/** `acme/payments-api` → `payments-api`. */
export function repoSlug(fullName: string): string {
  const tail = fullName.includes('/') ? fullName.slice(fullName.lastIndexOf('/') + 1) : fullName;
  return (
    tail
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'repo'
  );
}

/**
 * A short, stable heading for one rule — the first few words, kebab-cased. It
 * is a section label, not an identifier: nothing looks it up, so a collision
 * between two rules costs nothing.
 */
export function ruleSlug(rule: string): string {
  const words = rule
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  const picked = words.slice(0, 4);
  return picked.length > 0 ? picked.join('-') : 'rule';
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'all',
  'any',
  'use',
  'via',
  'not',
  'are',
  'its',
  'must',
  'that',
  'this',
  'with',
  'from',
  'into',
  'always',
  'never',
  'every',
  'should',
  'through',
]);

/** Fence language from the file extension — cosmetic; unknown ⇒ no language. */
function fenceLang(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  const known: Record<string, string> = {
    ts: 'ts',
    tsx: 'tsx',
    js: 'js',
    jsx: 'jsx',
    mjs: 'js',
    cjs: 'js',
    json: 'json',
    py: 'python',
    go: 'go',
    rs: 'rust',
    rb: 'ruby',
    java: 'java',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
    sql: 'sql',
    sh: 'sh',
  };
  return known[ext] ?? '';
}

/** `src/api/users.ts:23-31`, or `…:23` when the evidence is one line. */
export function evidenceRef(c: ConventionCandidate): string {
  const { evidence_path: path, evidence_start_line: from, evidence_end_line: to } = c;
  return from === to ? `${path}:${from}` : `${path}:${from}-${to}`;
}

/**
 * Compose the draft. `candidates` is expected to be the ACCEPTED set, already
 * ordered the way the screen shows them — the caller filters, this renders.
 */
export function composeSkillDraft(
  repoFullName: string,
  candidates: ConventionCandidate[],
): ConventionSkillDraft {
  const slug = repoSlug(repoFullName);
  const name = `${slug}-conventions`;

  const intro =
    `House conventions for \`${repoFullName}\`. Flag changes that violate any rule ` +
    'below and cite the offending `file:line`.';

  const sections = candidates.map((c) => {
    const fence = fenceLang(c.evidence_path);
    return [
      `## ${ruleSlug(c.rule)}`,
      c.rule,
      '',
      `Detected in \`${evidenceRef(c)}\`:`,
      '',
      '```' + fence,
      c.evidence_snippet,
      '```',
    ].join('\n');
  });

  const body = [`# ${name}`, '', intro, '', ...sections].join('\n').trimEnd() + '\n';

  return {
    name,
    description: `${candidates.length} house convention${
      candidates.length === 1 ? '' : 's'
    } extracted from ${slug}`,
    type: DRAFT_TYPE,
    body,
    convention_ids: candidates.map((c) => c.id),
    // The files the body cites, de-duplicated and in first-cited order — this
    // is what the Skills screen shows as the skill's provenance.
    evidence_files: [...new Set(candidates.map((c) => c.evidence_path))],
  };
}
