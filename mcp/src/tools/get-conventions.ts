/** Ring 2 — `get_conventions`: the accepted house rules of one repository. */
import {
  compactConventions,
  renderConventionsText,
  type ConventionsResult,
  type ToolOutput,
} from '../format.js';
import { resolveRepo } from '../resolve.js';
import type { ToolContext, ToolDeps } from './context.js';

export interface GetConventionsArgs {
  repo: string;
  limit?: number;
}

export async function getConventions(
  deps: Pick<ToolDeps, 'api'>,
  args: GetConventionsArgs,
  ctx: ToolContext = {},
): Promise<ToolOutput<ConventionsResult>> {
  const repo = await resolveRepo(deps.api, args.repo, ctx.signal);
  const view = await deps.api.getConventions(repo.id, ctx.signal);
  // `scan: null` (never scanned) is an empty result with a next step, not an error.
  const data = compactConventions(view, {
    repo: repo.full_name,
    ...(args.limit !== undefined ? { limit: args.limit } : {}),
  });
  return { data, text: renderConventionsText(data) };
}
