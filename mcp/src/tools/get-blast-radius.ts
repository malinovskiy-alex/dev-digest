/** Ring 2 — `get_blast_radius`: the PR's blast radius, as the Overview card shows it. */
import { compactBlast, renderBlastText, type BlastResult, type ToolOutput } from '../format.js';
import { resolveRepoAndPr } from '../resolve.js';
import type { ToolContext, ToolDeps } from './context.js';

export interface GetBlastRadiusArgs {
  repo: string;
  pr: number;
}

export async function getBlastRadius(
  deps: Pick<ToolDeps, 'api'>,
  args: GetBlastRadiusArgs,
  ctx: ToolContext = {},
): Promise<ToolOutput<BlastResult>> {
  // An unknown repo or PR throws the resolver's ToolError (names the next step).
  const { repo, pr } = await resolveRepoAndPr(deps.api, args.repo, args.pr, ctx.signal);
  const blast = await deps.api.getBlastRadius(pr.id, ctx.signal);
  const data = compactBlast(blast, { repo: repo.full_name, pr: pr.number });
  return { data, text: renderBlastText(data) };
}
