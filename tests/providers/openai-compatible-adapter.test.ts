import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOpenAiCompatibleAdapter } from '../../src/providers/adapters/openai-compatible.adapter';
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
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'sk-test',
  timeoutMs: 5000,
};

describe('createOpenAiCompatibleAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('streams answer deltas, reasoning deltas and usage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"delta":{"reasoning":"think"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        'data: {"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n',
        'data: [DONE]\n\n',
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createOpenAiCompatibleAdapter(CONFIG);
    const events: ProviderEvent[] = [];
    for await (const event of adapter.stream({
      externalModelId: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.7,
      maxOutputTokens: 100,
      topP: 1,
    })) {
      events.push(event);
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      { type: 'delta', channel: 'reasoning', text: 'think' },
      { type: 'delta', channel: 'answer', text: 'Hello' },
      { type: 'delta', channel: 'answer', text: ' world' },
      { type: 'usage', usage: { inputTokens: 10, outputTokens: 5, reasoningTokens: undefined } },
    ]);
  });

  it('accumulates tool calls across chunks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"search","arguments":"{\\"q\\":\\"a"}}]}}]}\n\n',
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"bc\\"}"}}]}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      ),
    );

    const adapter = createOpenAiCompatibleAdapter(CONFIG);
    const events: ProviderEvent[] = [];
    for await (const event of adapter.stream({
      externalModelId: 'gpt-4o',
      messages: [{ role: 'user', content: 'search' }],
      temperature: 0.7,
      maxOutputTokens: 100,
      topP: 1,
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      {
        type: 'tool_calls',
        calls: [{ id: 'call_1', name: 'search', arguments: '{"q":"abc"}' }],
      },
    ]);
  });
});
