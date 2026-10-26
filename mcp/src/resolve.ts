/**
 * Ring 2 — one port call plus one pure match per entity.
 *
 * The model addresses things by `owner/name`, PR number and agent name; the
 * API only takes uuids. Everything sent onward is an id the API returned.
 */
import type { DevDigestApi } from './api/port.js';
import type { Agent, PrMeta, Repo } from './api/types.js';
import { matchAgent, matchPr, matchRepo, parseRepo, type ResolvedPr } from './match.js';

export async function resolveRepo(api: DevDigestApi, repo: string, signal?: AbortSignal): Promise<Repo> {
  const ref = parseRepo(repo); // a bad format fails before any request
  return matchRepo(await api.listRepos(signal), ref);
}

export async function resolvePr(
  api: DevDigestApi,
  repo: Repo,
  number: number,
  signal?: AbortSignal,
): Promise<ResolvedPr<PrMeta>> {
  return matchPr(await api.listPulls(repo.id, signal), number, repo.full_name);
}

export async function resolveRepoAndPr(
  api: DevDigestApi,
  repo: string,
  pr: number,
  signal?: AbortSignal,
): Promise<{ repo: Repo; pr: ResolvedPr<PrMeta> }> {
  const r = await resolveRepo(api, repo, signal);
  return { repo: r, pr: await resolvePr(api, r, pr, signal) };
}

export async function resolveAgent(api: DevDigestApi, agent: string, signal?: AbortSignal): Promise<Agent> {
  return matchAgent(await api.listAgents(signal), agent);
}
