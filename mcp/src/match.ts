/**
 * Ring 1 — turn what the model typed into the entity the API knows.
 *
 * Pure: every function works on its arguments only. The lists come from the
 * port (see `resolve.ts`); this file never fetches. Each miss throws a
 * `ToolError` whose message names the next step.
 */
import type { Agent, PrMeta, Repo } from '@devdigest/shared';
import { ToolError } from './errors.js';
import { AGENT_ID_MAX, AGENT_NAME_MAX, REPO_MAX, clean } from './format.js';

/** The fields of each entity a match needs — any wider object satisfies them. */
export type RepoLike = Pick<Repo, 'id' | 'full_name'>;
export type PrLike = Pick<PrMeta, 'id' | 'number'>;
export type AgentLike = Pick<Agent, 'id' | 'name'>;

/** A PR row the API has persisted, i.e. one that carries an id we can address. */
export type ResolvedPr<P extends PrLike> = P & { id: string };

export interface RepoRef {
  owner: string;
  name: string;
  full_name: string;
}

/** GitHub's own character set for owner and repo names. */
const REPO_PATTERN = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;

/** How many imported repo names a "not imported" error lists. */
const MAX_LISTED_REPOS = 10;

export function parseRepo(input: string): RepoRef {
  const trimmed = input.trim();
  const m = REPO_PATTERN.exec(trimmed);
  if (!m || !m[1] || !m[2]) {
    throw new ToolError(
      'bad_repo',
      `Invalid repo "${clean(input, REPO_MAX)}". Expected owner/name, e.g. repo="acme/api".`,
    );
  }
  return { owner: m[1], name: m[2], full_name: `${m[1]}/${m[2]}` };
}

export function matchRepo<R extends RepoLike>(repos: readonly R[], ref: RepoRef): R {
  const wanted = ref.full_name.toLowerCase();
  const hit = repos.find((r) => r.full_name.toLowerCase() === wanted);
  if (hit) return hit;
  if (repos.length === 0) {
    throw new ToolError(
      'repo_not_found',
      `Repository ${ref.full_name} is not imported in DevDigest, and no repository is imported yet. Add it in the UI first.`,
    );
  }
  const names = repos.slice(0, MAX_LISTED_REPOS).map((r) => clean(r.full_name, REPO_MAX));
  const more = repos.length > MAX_LISTED_REPOS ? ` (+${repos.length - MAX_LISTED_REPOS} more)` : '';
  throw new ToolError(
    'repo_not_found',
    `Repository ${ref.full_name} is not imported in DevDigest. Add it in the UI, or use one of: ${names.join(', ')}${more}.`,
  );
}

export function matchPr<P extends PrLike>(pulls: readonly P[], number: number, repoFullName: string): ResolvedPr<P> {
  const hit = pulls.find((p) => p.number === number);
  if (hit && typeof hit.id === 'string' && hit.id.length > 0) return hit as ResolvedPr<P>;
  throw new ToolError(
    'pr_not_found',
    `PR #${number} not found in ${repoFullName}. Only the 50 most recent PRs are synced, and syncing needs a GitHub token — open the repo's PR list in the UI, then retry.`,
  );
}

/**
 * Id or exact name (case-insensitive). An id match wins over a name match.
 * Two agents with the same name is ambiguous: the caller must pass an id.
 */
export function matchAgent<A extends AgentLike>(agents: readonly A[], ref: string): A {
  const wanted = ref.trim();
  const byId = agents.find((a) => a.id === wanted);
  if (byId) return byId;
  const lower = wanted.toLowerCase();
  const byName = agents.filter((a) => a.name.toLowerCase() === lower);
  if (byName.length === 1 && byName[0]) return byName[0];
  if (byName.length > 1) {
    throw new ToolError(
      'agent_ambiguous',
      `Agent name "${clean(ref, AGENT_NAME_MAX)}" matches ${byName.length} agents (ids: ${byName.map((a) => clean(a.id, AGENT_ID_MAX)).join(', ')}) — pass the id instead.`,
    );
  }
  throw new ToolError(
    'agent_unknown',
    `Unknown agent "${clean(ref, AGENT_NAME_MAX)}". Call list_agents to get a valid agent id or name.`,
  );
}
