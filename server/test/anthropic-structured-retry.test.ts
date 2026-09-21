/**
 * What the Anthropic adapter sends on the SECOND attempt.
 *
 * `completeStructured` forces tool use, so every answer arrives as a
 * `tool_use` block. When that block fails schema validation the adapter asks
 * again — and Anthropic rejects the whole request with a 400 ("`tool_use` ids
 * were found without `tool_result` blocks immediately after") unless the reply
 * to a `tool_use` is a `tool_result` for that exact id.
 *
 * It only bites when attempt 1 fails validation, which is why it survived: the
 * happy path never builds a second message, so every green run and every test
 * that stubbed a valid first answer agreed the adapter worked.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';

const create = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create };
    models = { list: vi.fn() };
  },
}));

const { AnthropicProvider } = await import('../src/adapters/llm/anthropic.js');

const TOOL_USE_ID = 'toolu_014TnWCzRdfKCkCmTeAf9hMQ';

/** One Anthropic response carrying a forced tool_use block. */
const answer = (input: unknown) => ({
  content: [{ type: 'tool_use', id: TOOL_USE_ID, name: 'Findings', input }],
  usage: { input_tokens: 10, output_tokens: 5 },
});

beforeEach(() => create.mockReset());

describe('AnthropicProvider.completeStructured — the retry message', () => {
  const schema = z.object({ count: z.number() });

  const call = () =>
    new AnthropicProvider('test-key').completeStructured({
      model: 'claude-sonnet-5',
      schema,
      schemaName: 'Findings',
      messages: [{ role: 'user', content: 'go' }],
    });

  it('answers a rejected tool_use with a tool_result for the same id', async () => {
    create
      .mockResolvedValueOnce(answer({ count: 'not a number' })) // fails the schema
      .mockResolvedValueOnce(answer({ count: 3 }));

    const result = await call();
    expect(result.data).toEqual({ count: 3 });
    expect(result.attempts).toBe(2);

    // The message list on the retry: [user, assistant(tool_use), user(tool_result)]
    const retry = create.mock.calls[1]![0] as {
      messages: { role: string; content: unknown }[];
    };
    const reply = retry.messages.at(-1)!;
    expect(reply.role).toBe('user');

    const blocks = reply.content as { type: string; tool_use_id?: string; is_error?: boolean }[];
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks[0]).toMatchObject({
      type: 'tool_result',
      tool_use_id: TOOL_USE_ID,
      is_error: true,
    });
  });

  it('keeps the assistant turn that carried the tool_use', async () => {
    create
      .mockResolvedValueOnce(answer({ count: 'nope' }))
      .mockResolvedValueOnce(answer({ count: 1 }));

    await call();

    const retry = create.mock.calls[1]![0] as { messages: { role: string }[] };
    // Anthropic requires the tool_result to sit IMMEDIATELY after its tool_use,
    // so the assistant turn cannot be dropped to "simplify" the history.
    expect(retry.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('falls back to plain text when the model returned no tool_use at all', async () => {
    create
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'I would rather not.' }],
        usage: { input_tokens: 4, output_tokens: 2 },
      })
      .mockResolvedValueOnce(answer({ count: 7 }));

    const result = await call();
    expect(result.data).toEqual({ count: 7 });

    const retry = create.mock.calls[1]![0] as { messages: { content: unknown }[] };
    // No id to answer, so a tool_result would be invalid in the other direction.
    expect(typeof retry.messages.at(-1)!.content).toBe('string');
  });
});
