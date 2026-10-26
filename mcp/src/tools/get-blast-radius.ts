/** Ring 2 — `get_blast_radius`: a stub until the L04 homework fills it in. */
import { ToolError } from '../errors.js';
import type { ToolOutput } from '../format.js';
import type { ToolContext, ToolDeps } from './context.js';

export interface GetBlastRadiusArgs {
  repo: string;
  pr: number;
}

export async function getBlastRadius(
  _deps: Partial<ToolDeps>,
  _args: GetBlastRadiusArgs,
  _ctx: ToolContext = {},
): Promise<ToolOutput<never>> {
  throw new ToolError(
    'not_implemented',
    'get_blast_radius is not implemented yet (L04 homework) — use get_findings or Smart Diff in the UI.',
  );
}
