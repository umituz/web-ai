import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAnthropicAdapter } from '../../src/providers/adapters/anthropic.adapter';
import type { AdapterConfig, ProviderEvent } from '../../src/providers/adapters/adapter.types';

function sseResponse(frames: readonly string[], status = 200): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

const CONFIG: AdapterConfig = {
  baseUrl: 'https://api.anthropic.com',
  apiKey: 'sk-ant-test',
  timeoutMs: 5000,
};

describe('createAnthropicAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('streams text deltas, thinking deltas, and usage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        'data: {"type":"message_start","message":{"usage":{"input_tokens":15}}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"Plan"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Result"}}\n\n',
        'data: {"type":"message_delta","usage":{"output_tokens":8}}\n\n',
        'data: {"type":"message_stop"}\n\n',
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createAnthropicAdapter(CONFIG);
    const events: ProviderEvent[] = [];
    for await (const event of adapter.stream({
      externalModelId: 'claude-3-5-sonnet-20241022',
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Question' },
      ],
      temperature: 0.5,
      maxOutputTokens: 200,
      topP: 1,
    })) {
      events.push(event);
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { system?: string; max_tokens?: number };
    expect(body.system).toBe('You are helpful');
    expect(body.max_tokens).toBe(200);

    expect(events).toEqual([
      { type: 'delta', channel: 'reasoning', text: 'Plan' },
      { type: 'delta', channel: 'answer', text: 'Result' },
      { type: 'usage', usage: { inputTokens: 15, outputTokens: 8, reasoningTokens: undefined } },
    ]);
  });
});
