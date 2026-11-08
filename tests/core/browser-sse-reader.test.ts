import { describe, expect, it, vi } from 'vitest';
import {
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
