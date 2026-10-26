/**
 * Ring 1 — the one error type a tool handler throws.
 *
 * `message` is the user-facing text, written so it names the next step
 * (spec principle 4, "errors lead forward"). Only `server.ts` turns it into an
 * `isError: true` tool result; nothing here knows about MCP.
 */

export type ToolErrorCode =
  | 'api_down'
  | 'http_timeout'
  | 'aborted'
  | 'bad_repo'
  | 'repo_not_found'
  | 'pr_not_found'
  | 'agent_unknown'
  | 'agent_ambiguous'
  | 'rate_limited'
  | 'run_failed'
  | 'run_reaped'
  | 'run_cancelled'
  | 'run_not_found'
  | 'review_not_found'
  | 'not_reviewed'
  | 'not_implemented'
  | 'bad_response'
  | 'start_mismatch'
  | 'http_error';

export class ToolError extends Error {
  readonly code: ToolErrorCode;

  constructor(code: ToolErrorCode, message: string) {
    super(message);
    this.name = 'ToolError';
    this.code = code;
  }
}

export function isToolError(err: unknown): err is ToolError {
  return err instanceof ToolError;
}
