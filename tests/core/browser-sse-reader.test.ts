import { describe, expect, it, vi } from 'vitest';
import {
  iterateSseData,
  iterateSseJson,
  parseSseEvent,
  readSseResponse,
  type StreamCallbacks,
} from '../../src/core/sse/browser-sse-reader';

describe('browser-sse-reader', () => {
  it('parseSseEvent extracts json data payload from SSE lines', () => {
    const raw = 'event: delta\ndata: {"type":"delta","channel":"answer","text":"hello"}\n';
    const parsed = parseSseEvent(raw);
    expect(parsed).toEqual({ type: 'delta', channel: 'answer', text: 'hello' });
  });

  it('parseSseEvent returns null for invalid json or missing data line', () => {
    expect(parseSseEvent('event: ping\n')).toBeNull();
    expect(parseSseEvent('data: invalid-json\n')).toBeNull();
  });

  it('readSseResponse parses response stream and dispatches callbacks', async () => {
    const sseText = [
      'event: delta\ndata: {"type":"delta","channel":"answer","text":"Hi"}\n\n',
      'event: usage\ndata: {"type":"usage","usage":{"inputTokens":5,"outputTokens":1}}\n\n',
      'event: done\ndata: {"type":"done","messageId":"msg_42"}\n\n',
    ].join('');

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(sseText));
        controller.close();
      },
    });

    const response = new Response(stream);

    const onDelta = vi.fn();
    const onUsage = vi.fn();
    const onDone = vi.fn();
    const callbacks: StreamCallbacks = { onDelta, onUsage, onDone };

    await readSseResponse(response, callbacks);

    expect(onDelta).toHaveBeenCalledWith('answer', 'Hi');
    expect(onUsage).toHaveBeenCalledWith({ inputTokens: 5, outputTokens: 1 });
    expect(onDone).toHaveBeenCalledWith('msg_42');
  });
});

describe('iterateSseData / iterateSseJson', () => {
  const streamOf = (chunks: string[], onCancel?: () => void): ReadableStream<Uint8Array> => {
    const encoder = new TextEncoder();
    let index = 0;
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        if (index >= chunks.length) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(chunks[index]));
        index += 1;
      },
      cancel: onCancel,
    });
  };

  it('iterateSseData yields each data payload and skips data-less frames', async () => {
    const body = streamOf([
      'event: user\ndata: {"type":"user"}\n\n',
      ': keep-alive comment\n\n',
      'data: {"type":"delta"}\n\n',
    ]);
    const seen: string[] = [];
    for await (const data of iterateSseData(body)) seen.push(data);
    expect(seen).toEqual(['{"type":"user"}', '{"type":"delta"}']);
  });

  it('iterateSseData reassembles a payload split across network chunks', async () => {
    const body = streamOf(['data: {"type":"del', 'ta","text":"Hi"}\n', '\ndata: [1,2]\n\n']);
    const seen: string[] = [];
    for await (const data of iterateSseData(body)) seen.push(data);
    expect(seen).toEqual(['{"type":"delta","text":"Hi"}', '[1,2]']);
  });

  it('iterateSseData joins multi-line data payloads with a newline', async () => {
    const body = streamOf(['data: line one\ndata: line two\n\n']);
    const seen: string[] = [];
    for await (const data of iterateSseData(body)) seen.push(data);
    expect(seen).toEqual(['line one\nline two']);
  });

  it('iterateSseData accepts a Response and throws when it has no body', async () => {
    const response = new Response(streamOf(['data: "x"\n\n']));
    const seen: string[] = [];
    for await (const data of iterateSseData(response)) seen.push(data);
    expect(seen).toEqual(['"x"']);

    await expect(async () => {
      for await (const _ of iterateSseData(new Response(null))) void _;
    }).rejects.toThrow(/no body/);
  });

  it('iterateSseJson parses frames and skips malformed ones without dying', async () => {
    const body = streamOf([
      'data: {"type":"user"}\n\n',
      'data: not-json\n\n',
      'data: {"type":"done"}\n\n',
    ]);
    const seen: unknown[] = [];
    for await (const event of iterateSseJson<{ type: string }>(body)) seen.push(event);
    expect(seen).toEqual([{ type: 'user' }, { type: 'done' }]);
  });

  it('breaking out of the loop cancels the underlying stream', async () => {
    const onCancel = vi.fn();
    const body = streamOf(['data: {"n":1}\n\n', 'data: {"n":2}\n\n'], onCancel);

    for await (const _ of iterateSseData(body)) {
      void _;
      break;
    }

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
