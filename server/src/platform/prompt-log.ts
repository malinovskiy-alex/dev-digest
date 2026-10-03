import type { PromptSectionMeta } from '@devdigest/reviewer-core';

/**
 * Structured log of prompt ASSEMBLY — what went into a prompt, never the prompt.
 *
 * The only input is `PromptSectionMeta` (names, sources, sizes, a fingerprint),
 * which has no text field. So no mode of this logger can print a diff, a spec,
 * a ticket, an author's description, a skill body or the system prompt: there
 * is nothing to print. Keep it that way — do not add a "preview" field.
 *
 * Default: one `info` line per LLM call (`event: "prompt.assembled"`).
 * Verbose (`config.promptLogVerbose`, local development only): a second line
 * (`event: "prompt.assembled.detail"`) with per-item sizes, fingerprints and
 * the chunk label (a file path in map-reduce).
 */

/** pino-compatible `(obj, msg)` sink. */
export interface PromptLogSink {
  info: (obj: unknown, msg?: string) => void;
}

export interface PromptLogContext {
  /** Ties this line to the rest of the operation: the run id, or the request id. */
  correlationId: string;
  kind: 'review' | 'intent';
  provider: string;
  model: string;
  prId: string;
  runId?: string;
  agent?: string;
  /** Map-reduce position; single-pass and intent are `{ index: 0, total: 1 }`. */
  chunk?: { index: number; total: number; label?: string };
}

export function logPromptAssembly(
  logger: PromptLogSink | undefined,
  ctx: PromptLogContext,
  sections: PromptSectionMeta[],
  verbose: boolean,
): void {
  if (!logger) return;
  const totalChars = sections.reduce((n, s) => n + s.chars, 0);
  const base = {
    event: 'prompt.assembled',
    correlation_id: ctx.correlationId,
    kind: ctx.kind,
    provider: ctx.provider,
    model: ctx.model,
    pr_id: ctx.prId,
    ...(ctx.runId ? { run_id: ctx.runId } : {}),
    ...(ctx.agent ? { agent: ctx.agent } : {}),
    chunk: { index: ctx.chunk?.index ?? 0, total: ctx.chunk?.total ?? 1 },
    total_chars: totalChars,
    total_approx_tokens: Math.ceil(totalChars / 4),
    sections: sections.map((s) => ({
      name: s.name,
      source: s.source,
      trust: s.trust,
      chars: s.chars,
      approx_tokens: s.approx_tokens,
    })),
  };
  logger.info(
    base,
    `prompt: ${ctx.kind} ${ctx.provider}/${ctx.model} — ${sections.length} section(s), ${totalChars} chars (~${base.total_approx_tokens} tok)`,
  );

  if (!verbose) return;
  logger.info(
    {
      event: 'prompt.assembled.detail',
      correlation_id: ctx.correlationId,
      kind: ctx.kind,
      ...(ctx.chunk?.label ? { chunk_label: ctx.chunk.label } : {}),
      sections: sections.map((s) => ({
        name: s.name,
        chars: s.chars,
        fingerprint: s.fingerprint,
        ...(s.items ? { items: s.items } : {}),
      })),
    },
    `prompt detail: ${ctx.kind} ${ctx.correlationId}`,
  );
}
