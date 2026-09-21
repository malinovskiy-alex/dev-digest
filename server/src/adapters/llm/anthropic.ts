import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  ModelInfo,
  CompletionRequest,
  CompletionResult,
  StructuredRequest,
  StructuredResult,
  ChatMessage,
} from '@devdigest/shared';
import { withRetry, withTimeout } from '../../platform/resilience.js';
import { toJsonSchema, parseWithRepair } from '../../platform/structured.js';
import { estimateCost } from './pricing.js';
import { ExternalServiceError } from '../../platform/errors.js';

const DEFAULT_TIMEOUT = 60_000;
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Models that still accept the sampling parameters.
 *
 * Anthropic removed `temperature` / `top_p` / `top_k` with the current
 * generation — Opus 4.7 and everything after it, including Opus 5 and
 * Sonnet 5, answer a request carrying one with a 400. Opus 4.6, Sonnet 4.6,
 * Haiku 4.5 and older still take them.
 *
 * An ALLOW-list rather than a deny-list on purpose: `listModels()` is a live
 * `GET /models`, so the studio offers models this file has never heard of, and
 * the safe default for an unknown one is to omit `temperature` (the API's own
 * default applies) instead of failing every run against it.
 */
const SAMPLING_MODELS = new Set([
  'claude-haiku-4-5',
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-3-5-sonnet-latest',
  'claude-3-5-haiku-latest',
  'claude-3-opus-latest',
]);

/** Spread into a request: the temperature when the model takes one, else nothing. */
export function samplingFor(model: string, temperature: number): { temperature?: number } {
  return SAMPLING_MODELS.has(model) ? { temperature } : {};
}

/** Anthropic has no embeddings API; embeddings come from the OpenAI Embedder. */
function splitSystem(messages: ChatMessage[]): {
  system: string;
  rest: Anthropic.MessageParam[];
} {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const rest = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  return { system, rest };
}

/**
 * Anthropic LLMProvider.
 * - listModels: dynamic via GET /models.
 * - completeStructured: FORCED tool-use (single tool, input_schema = our JSON
 *   schema, tool_choice forces it), parse tool_use.input, Zod validate + reprompt.
 * - embed: NOT supported (throws) — use the OpenAI Embedder for vectors.
 */
export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic' as const;
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async listModels(): Promise<ModelInfo[]> {
    return withRetry(async () => {
      // SDK 0.33 exposes models.list()
      const res = await this.client.models.list();
      return res.data.map((m) => ({
        id: m.id,
        provider: 'anthropic' as const,
        label: m.display_name,
      }));
    });
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    return withRetry(() => withTimeout(this.doComplete(req), req.timeoutMs ?? DEFAULT_TIMEOUT));
  }

  private async doComplete(req: CompletionRequest): Promise<CompletionResult> {
    const { system, rest } = splitSystem(req.messages);
    const res = await this.client.messages.create({
      model: req.model,
      system: system || undefined,
      messages: rest,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...samplingFor(req.model, req.temperature ?? 0.2),
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const tokensIn = res.usage.input_tokens;
    const tokensOut = res.usage.output_tokens;
    return {
      text,
      model: req.model,
      tokensIn,
      tokensOut,
      costUsd: estimateCost(req.model, tokensIn, tokensOut),
    };
  }

  async completeStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const jsonSchema = toJsonSchema(req.schema, req.schemaName);
    const toolName = req.schemaName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const maxRetries = req.maxRetries ?? 2;
    const { system, rest } = splitSystem(req.messages);
    const messages: Anthropic.MessageParam[] = [...rest];
    let tokensIn = 0;
    let tokensOut = 0;
    let lastRaw = '';

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const res = await withRetry(() =>
        withTimeout(
          this.client.messages.create({
            model: req.model,
            system: system || undefined,
            messages,
            max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
            ...samplingFor(req.model, req.temperature ?? 0),
            tools: [
              {
                name: toolName,
                description: `Return the result as ${req.schemaName}.`,
                input_schema: jsonSchema.schema as Anthropic.Tool.InputSchema,
              },
            ],
            // One answer, one block. Forcing the tool does not stop the model
            // emitting several `tool_use` blocks in one turn, and every one of
            // them would need its own `tool_result` on a retry — see the
            // reprompt below, which now answers all of them anyway.
            tool_choice: { type: 'tool', name: toolName, disable_parallel_tool_use: true },
          }),
          req.timeoutMs ?? DEFAULT_TIMEOUT,
        ),
      );
      tokensIn += res.usage.input_tokens;
      tokensOut += res.usage.output_tokens;

      const toolUses = res.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      lastRaw = toolUses[0] ? JSON.stringify(toolUses[0].input) : '';

      const parsed = parseWithRepair(req.schema, lastRaw);
      if (parsed.ok) {
        return {
          data: parsed.data,
          model: req.model,
          tokensIn,
          tokensOut,
          costUsd: estimateCost(req.model, tokensIn, tokensOut),
          raw: lastRaw,
          attempts: attempt,
        };
      }
      // The reprompt has to come back as a `tool_result` for the block we just
      // received. Anthropic rejects the whole request with a 400 —
      // "`tool_use` ids were found without `tool_result` blocks immediately
      // after" — if a message containing `tool_use` is followed by plain text,
      // so a schema miss on attempt 1 turned every retry into a hard failure
      // instead of the second chance it was written to be. Only reachable when
      // the first structured answer fails validation, which is why it stayed
      // hidden: the happy path never builds a second message.
      // EVERY `tool_use` in the turn needs its own `tool_result`, not just the
      // one we parsed: the rule is about the ids in the message, and answering
      // one of two reproduces the very 400 this code exists to avoid.
      // `disable_parallel_tool_use` above should keep it at one, but the guard
      // costs nothing and does not depend on that flag still being set.
      //
      // An empty assistant turn is skipped rather than echoed — a turn that
      // stopped on `max_tokens` before emitting a block has `content: []`, and
      // Anthropic rejects a message with empty content just as firmly, which
      // would again turn a recoverable schema miss into a failed run.
      if (res.content.length > 0) {
        messages.push({ role: 'assistant', content: res.content });
        messages.push({
          role: 'user',
          content:
            toolUses.length > 0
              ? toolUses.map((t) => ({
                  type: 'tool_result' as const,
                  tool_use_id: t.id,
                  is_error: true,
                  content: parsed.repromptMessage,
                }))
              : parsed.repromptMessage,
        });
      } else {
        messages.push({ role: 'user', content: parsed.repromptMessage });
      }
    }

    throw new ExternalServiceError('Anthropic structured output failed schema validation', {
      raw: lastRaw,
    });
  }

  async embed(): Promise<number[][]> {
    throw new ExternalServiceError(
      'Anthropic does not provide embeddings; use the OpenAI Embedder.',
    );
  }
}
