/** Ring 2 — `list_agents`: the configured reviewer agents, without their prompts. */
import { compactAgents, renderAgentsText, type AgentsResult, type ToolOutput } from '../format.js';
import type { ToolContext, ToolDeps } from './context.js';

export type ListAgentsArgs = Record<string, never>;

export async function listAgents(
  deps: Pick<ToolDeps, 'api'>,
  _args: ListAgentsArgs,
  ctx: ToolContext = {},
): Promise<ToolOutput<AgentsResult>> {
  const data = compactAgents(await deps.api.listAgents(ctx.signal));
  return { data, text: renderAgentsText(data) };
}
