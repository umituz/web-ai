import { describe, expect, it, vi } from 'vitest';
import {
  runWorkersAIText,
  streamWorkersAIText,
  workersAIConfigured,
  WORKERS_AI_LLM_MODEL,
} from '../../src/providers/workers-ai/workers-ai.text';
import {
  WorkersAIError,
  type WorkersAIBinding,
  type WorkersAIEnv,
} from '../../src/providers/workers-ai/workers-ai.entities';
import { speakWithWorkersAI } from '../../src/providers/workers-ai/workers-ai.speech';
import { WorkersAIProvider } from '../../src/providers/workers-ai/workers-ai.provider';
import { createAI } from '../../src/providers/factory/create-ai';

const MESSAGES = [{ role: 'user' as const, content: 'Write a logline' }];

function envWith(run: WorkersAIBinding['run']): WorkersAIEnv {
  return { AI: { run } };
}

function sseBody(frames: readonly string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(frames.join('\n') + '\n'));
      controller.close();
    },
  });
}

describe('workersAIConfigured', () => {
  it('is false without a binding and true with a callable one', () => {
    expect(workersAIConfigured({})).toBe(false);
    expect(workersAIConfigured({ AI: undefined })).toBe(false);
    expect(workersAIConfigured(envWith(async () => ({})))).toBe(true);
  });
});

describe('runWorkersAIText', () => {
  it('reads the documented {response} mirror shape', async () => {
    const run = vi.fn<WorkersAIBinding["run"]>(async () => ({ response: 'A heist in reverse.' }));
    const text = await runWorkersAIText(envWith(run), MESSAGES);
    expect(text).toBe('A heist in reverse.');
    expect(run).toHaveBeenCalledWith(WORKERS_AI_LLM_MODEL, {
      messages: MESSAGES,
      max_tokens: 900,
      temperature: 0.7,
    });
  });

  it('falls back to the OpenAI chat.completion body when the mirror is missing', async () => {
    const run = vi.fn<WorkersAIBinding["run"]>(async () => ({
      choices: [{ message: { content: 'From the vault outward.' } }],
    }));
    const text = await runWorkersAIText(envWith(run), MESSAGES);
    expect(text).toBe('From the vault outward.');
  });

  it('also falls back when the mirror is present but empty', async () => {
    const run = vi.fn<WorkersAIBinding["run"]>(async () => ({
      response: '',
      choices: [{ message: { content: 'Recovered mirror.' } }],
    }));
    expect(await runWorkersAIText(envWith(run), MESSAGES)).toBe('Recovered mirror.');
  });

  it('throws WorkersAIError when neither shape carries text', async () => {
    const env = envWith(async () => ({}));
    await expect(runWorkersAIText(env, MESSAGES)).rejects.toBeInstanceOf(WorkersAIError);
  });

  it('throws when the binding is absent', async () => {
    await expect(runWorkersAIText({}, MESSAGES)).rejects.toThrow('Workers AI is not configured');
  });

  it('passes options through and honors an explicit model', async () => {
    const run = vi.fn<WorkersAIBinding["run"]>(async () => ({ response: 'ok' }));
    await runWorkersAIText(envWith(run), MESSAGES, {
      model: '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
      maxTokens: 100,
      temperature: 0.2,
    });
    expect(run).toHaveBeenCalledWith('@cf/meta/llama-3.1-8b-instruct-fp8-fast', {
      messages: MESSAGES,
      max_tokens: 100,
      temperature: 0.2,
    });
  });

  it('normalizes message objects (no extra keys reach the binding)', async () => {
    const run = vi.fn<WorkersAIBinding["run"]>(async () => ({ response: 'ok' }));
    await runWorkersAIText(envWith(run), [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi', extra: 'dropped' } as never,
    ]);
    const sent = (run.mock.calls[0]?.[1] as { messages: unknown[] }).messages;
    expect(sent).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
    ]);
  });
});

describe('streamWorkersAIText', () => {
  it('yields tokens off SSE frames and stops at [DONE]', async () => {
    const env = envWith(async () =>
      sseBody([
        'data: {"response": "A "}',
        'data: {"response": "heist"}',
        'data: [DONE]',
        'data: {"response": " never yielded"}',
      ]),
    );
    const tokens: string[] = [];
    for await (const token of streamWorkersAIText(env, MESSAGES)) tokens.push(token);
    expect(tokens).toEqual(['A ', 'heist']);
  });

  it('reassembles a JSON payload split across chunk boundaries', async () => {
    // One enqueue splits the payload mid-JSON — the parser must push the
    // partial line back and wait for the rest instead of dropping it.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('data: {"resp'));
        controller.enqueue(encoder.encode('onse": "split"}\n\n'));
        controller.close();
      },
    });
    const env = envWith(async () => stream);
    const tokens: string[] = [];
    for await (const token of streamWorkersAIText(env, MESSAGES)) tokens.push(token);
    expect(tokens).toEqual(['split']);
  });

  it('skips comments, blank lines, and non-data lines', async () => {
    const env = envWith(async () =>
      sseBody([': keep-alive', '', 'event: ping', 'data: {"response": "kept"}']),
    );
    const tokens: string[] = [];
    for await (const token of streamWorkersAIText(env, MESSAGES)) tokens.push(token);
    expect(tokens).toEqual(['kept']);
  });

  it('tolerates \\r line endings', async () => {
    const env = envWith(async () => sseBody(['data: {"response": "cr"}\r']));
    const tokens: string[] = [];
    for await (const token of streamWorkersAIText(env, MESSAGES)) tokens.push(token);
    expect(tokens).toEqual(['cr']);
  });

  it('throws when the binding answers a non-stream body', async () => {
    const env = envWith(async () => ({ response: 'not a stream' }));
    await expect(async () => {
      for await (const _ of streamWorkersAIText(env, MESSAGES)) void _;
    }).rejects.toThrow('stream was not readable');
  });

  it('throws when the binding is absent', async () => {
    await expect(async () => {
      for await (const _ of streamWorkersAIText({}, MESSAGES)) void _;
    }).rejects.toThrow('Workers AI is not configured');
  });
});

describe('speakWithWorkersAI', () => {
  it('collects a ReadableStream of mp3 bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    const env = envWith(async () => stream);
    const result = await speakWithWorkersAI(env, { model: '@cf/myshell-ai/melotts' }, 'Hello');
    expect(Array.from(result.bytes)).toEqual([1, 2, 3]);
  });

  it('decodes the melotts {audio: base64} shape and sends prompt+lang', async () => {
    const run = vi.fn<WorkersAIBinding["run"]>(async () => ({ audio: btoa('binary-audio') }));
    const env = envWith(run);
    const result = await speakWithWorkersAI(env, { model: 'melotts', langParam: 'tr' }, 'Merhaba');
    expect(Array.from(result.bytes)).toEqual(Array.from(new TextEncoder().encode('binary-audio')));
    expect(run).toHaveBeenCalledWith('melotts', { prompt: 'Merhaba', lang: 'tr' });
  });

  it('sends {text} for engines without a langParam (aura-2)', async () => {
    const run = vi.fn<WorkersAIBinding["run"]>(async () => ({ audio: btoa('x') }));
    await speakWithWorkersAI(envWith(run), { model: '@cf/myshell-ai/aura-2-en' }, 'Hi');
    expect(run).toHaveBeenCalledWith('@cf/myshell-ai/aura-2-en', { text: 'Hi' });
  });

  it('throws on an empty stream', async () => {
    const empty = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    await expect(
      speakWithWorkersAI(envWith(async () => empty), { model: 'x' }, 'Hi'),
    ).rejects.toThrow('returned no audio');
  });

  it('throws on a foreign-shaped reply', async () => {
    await expect(
      speakWithWorkersAI(envWith(async () => ({ nada: true })), { model: 'x' }, 'Hi'),
    ).rejects.toThrow('returned no audio');
  });

  it('throws when the binding is absent', async () => {
    await expect(speakWithWorkersAI({}, { model: 'x' }, 'Hi')).rejects.toThrow(
      'Workers AI is not configured',
    );
  });
});

describe('WorkersAIProvider', () => {
  it('serves generate() through the tier map and reports its id', async () => {
    const run = vi.fn<WorkersAIBinding["run"]>(async () => ({ response: 'tier text' }));
    const provider = new WorkersAIProvider({ binding: { run } });
    const result = await provider.generate({ messages: MESSAGES, tier: 'fast' });
    expect(result).toMatchObject({ text: 'tier text', providerId: 'workers-ai' });
    expect(run.mock.calls[0]?.[0]).toBe('@cf/meta/llama-3.1-8b-instruct-fp8-fast');
  });

  it('an explicit model overrides the tier', async () => {
    const run = vi.fn<WorkersAIBinding["run"]>(async () => ({ response: 'x' }));
    const provider = new WorkersAIProvider({ binding: { run } });
    await provider.generate({ messages: MESSAGES, model: 'custom-model' });
    expect(run.mock.calls[0]?.[0]).toBe('custom-model');
  });

  it('moves systemPrompt into the leading system message', async () => {
    const run = vi.fn<WorkersAIBinding["run"]>(async () => ({ response: 'x' }));
    const provider = new WorkersAIProvider({ binding: { run } });
    await provider.generate({ messages: MESSAGES, systemPrompt: 'Be terse.' });
    const sent = (run.mock.calls[0]?.[1] as { messages: Array<{ role: string }> }).messages;
    expect(sent[0]?.role).toBe('system');
  });

  it('streams via callbacks and completes with the joined text', async () => {
    const env = envWith(async () => sseBody(['data: {"response": "ab"}', 'data: {"response": "cd"}']));
    const provider = new WorkersAIProvider({ binding: env.AI! });
    const chunks: string[] = [];
    let completed = '';
    const result = await provider.stream({ messages: MESSAGES }, {
      onChunk: (t) => chunks.push(t),
      onComplete: (r) => {
        completed = r.text;
      },
    });
    expect(chunks).toEqual(['ab', 'cd']);
    expect(result.text).toBe('abcd');
    expect(completed).toBe('abcd');
  });

  it('parses structured JSON output', async () => {
    const run = vi.fn<WorkersAIBinding["run"]>(async () => ({ response: '{"title": "Vault", "year": 2024}' }));
    const provider = new WorkersAIProvider({ binding: { run } });
    const { value } = await provider.generateStructured({
      messages: MESSAGES,
      schema: { type: 'object' },
    });
    expect(value).toEqual({ title: 'Vault', year: 2024 });
  });

  it('healthCheck reflects the binding, estimateCost is allocation-priced 0', async () => {
    const provider = new WorkersAIProvider({ binding: { run: async () => ({}) } });
    expect(await provider.healthCheck()).toBe('healthy');
    expect(await provider.estimateCost({ prompt: 'x' } as never)).toBe(0);
  });

  it('createAI registers it when the binding is present, skips when absent', async () => {
    const withBinding = createAI({ workersAI: { binding: { run: async () => ({ response: 'x' }) } } });
    const result = await withBinding.chat({ messages: MESSAGES });
    expect(result.providerId).toBe('workers-ai');

    const without = createAI({ workersAI: undefined });
    await expect(without.chat({ messages: MESSAGES })).rejects.toThrow();
  });
});
