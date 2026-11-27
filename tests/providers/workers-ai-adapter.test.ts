import { describe, expect, it, vi } from 'vitest';
import {
  createWorkersAIChatAdapter,
  WORKERS_AI_CONTEXT_WINDOW,
} from '../../src/providers/adapters/workers-ai.adapter';
import type { AdapterChatMessage } from '../../src/providers/adapters/adapter.types';
import type { WorkersAIBinding } from '../../src/providers/workers-ai/workers-ai.entities';
import { AiError } from '../../src/core/errors/unified-ai-error';
import { runConversation } from '../../src/providers/execution/run-conversation';

function sseBody(frames: readonly string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(frames.join('\n') + '\n'));
      controller.close();
    },
  });
}

function chunkedBody(text: string, chunkSize: number): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(bytes.slice(i, i + chunkSize));
  }
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

const FRAMES = [
  'data: {"response": "Merhaba"}',
  'data: {"response": ", farm"}',
  ': keep-alive comment',
  'data: {"response": " hand."}',
  'data: [DONE]',
];

const MESSAGES: AdapterChatMessage[] = [
  { role: 'system', content: 'Be brief.' },
  { role: 'user', content: 'Summarize the herd.' },
];

async function collect(iterable: AsyncIterable<{ type: string; channel?: string; text?: string }>) {
  const events: { type: string; channel?: string; text?: string }[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

describe('createWorkersAIChatAdapter', () => {
  it('yields answer deltas in frame order', async () => {
    const run = vi.fn<WorkersAIBinding['run']>(async () => sseBody(FRAMES));
    const adapter = createWorkersAIChatAdapter({ run });
    const events = await collect(adapter.stream({ externalModelId: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', messages: MESSAGES }));
    expect(events).toEqual([
      { type: 'delta', channel: 'answer', text: 'Merhaba' },
      { type: 'delta', channel: 'answer', text: ', farm' },
      { type: 'delta', channel: 'answer', text: ' hand.' },
    ]);
  });

  it('reassembles JSON payloads split across network chunks', async () => {
    const wire = FRAMES.join('\n') + '\n';
    const run = vi.fn<WorkersAIBinding['run']>(async () => chunkedBody(wire, 7));
    const adapter = createWorkersAIChatAdapter({ run });
    const events = await collect(adapter.stream({ externalModelId: 'm', messages: MESSAGES }));
    expect(events.map((e) => e.text).join('')).toBe('Merhaba, farm hand.');
  });

  it('merges system messages into one leading turn and folds tool roles', async () => {
    const run = vi.fn<WorkersAIBinding['run']>(async () => sseBody(['data: [DONE]']));
    const adapter = createWorkersAIChatAdapter({ run });
    await collect(
      adapter.stream({
        externalModelId: 'm',
        messages: [
          { role: 'system', content: 'One.' },
          { role: 'system', content: 'Two.' },
          { role: 'user', content: 'List fields' },
          {
            role: 'assistant',
            content: 'Checking',
            toolCalls: [{ id: 't1', name: 'field_list', arguments: '{}' }],
          },
          { role: 'tool', content: '12 fields', toolCallId: 't1' },
        ],
      }),
    );
    const sent = (run.mock.calls[0]?.[1] as { messages: { role: string; content: string }[] }).messages;
    expect(sent).toEqual([
      { role: 'system', content: 'One.\n\nTwo.' },
      { role: 'user', content: 'List fields' },
      { role: 'assistant', content: 'Checking\n\nRequested tools: field_list' },
      { role: 'user', content: 'Tool result: 12 fields' },
    ]);
  });

  it('passes sampling settings and drops undefined ones', async () => {
    const run = vi.fn<WorkersAIBinding['run']>(async () => sseBody(['data: [DONE]']));
    const adapter = createWorkersAIChatAdapter({ run });
    await collect(
      adapter.stream({
        externalModelId: 'm',
        messages: MESSAGES,
        maxOutputTokens: 512,
        temperature: 0.3,
      }),
    );
    expect(run.mock.calls[0]?.[1]).toEqual({
      messages: [
        { role: 'system', content: 'Be brief.' },
        { role: 'user', content: 'Summarize the herd.' },
      ],
      stream: true,
      max_tokens: 512,
      temperature: 0.3,
    });
  });

  it('throws missing_key when the binding is absent', async () => {
    const adapter = createWorkersAIChatAdapter(undefined);
    await expect(
      collect(adapter.stream({ externalModelId: 'm', messages: MESSAGES })),
    ).rejects.toBeInstanceOf(AiError);
  });

  it('throws upstream_error when run() resolves without a stream', async () => {
    const run = vi.fn<WorkersAIBinding['run']>(async () => ({ response: 'not a stream' }));
    const adapter = createWorkersAIChatAdapter({ run });
    await expect(
      collect(adapter.stream({ externalModelId: 'm', messages: MESSAGES })),
    ).rejects.toThrow('Workers AI stream was not readable');
  });

  it('surfaces adapter errors through runConversation as a failed turn', async () => {
    const run = vi.fn<WorkersAIBinding['run']>(async () => sseBody(FRAMES));
    const adapter = createWorkersAIChatAdapter({ run });
    const events: { type: string; [key: string]: unknown }[] = [];
    for await (const event of runConversation({
      history: [{ role: 'user', content: 'Summarize the herd.' }],
      systemPrompt: 'Be brief.',
      attempts: [
        {
          adapter,
          model: { externalModelId: 'm', contextWindow: WORKERS_AI_CONTEXT_WINDOW },
          settings: { temperature: 0.2, maxOutputTokens: 300 },
        },
      ],
    })) {
      events.push(event as { type: string; [key: string]: unknown });
    }
    const done = events.find((e) => e.type === 'done') as
      | { type: 'done'; result: { answer: string; usage: unknown } }
      | undefined;
    expect(done).toBeTruthy();
    expect(done?.result.answer).toBe('Merhaba, farm hand.');
    expect(events[0]).toEqual({ type: 'attempt', index: 0 });
  });
});
