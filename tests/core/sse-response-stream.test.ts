import { describe, expect, it } from 'vitest';
import {
  formatSseEvent,
  sseStreamResponse,
  replayFirst,
  type StreamEvent,
} from '../../src/core/streaming/sse-response';

describe('sse-response streaming', () => {
  it('formats SSE events correctly', () => {
    const event: StreamEvent = { type: 'delta', channel: 'answer', text: 'Hello' };
    const formatted = formatSseEvent(event);
    expect(formatted).toBe('event: delta\ndata: {"type":"delta","channel":"answer","text":"Hello"}\n\n');
  });

  it('produces a valid Response with text/event-stream headers', async () => {
    async function* generate(): AsyncIterable<StreamEvent> {
      yield { type: 'delta', channel: 'answer', text: 'A' };
      yield { type: 'done', messageId: 'msg_1' };
    }

    const response = sseStreamResponse(generate());
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');

    const text = await response.text();
    expect(text).toContain('event: delta');
    expect(text).toContain('event: done');
  });

  it('replayFirst prepends first item before rest of generator', async () => {
    async function* rest(): AsyncIterable<number> {
      yield 2;
      yield 3;
    }

    const out: number[] = [];
    for await (const val of replayFirst(1, rest())) {
      out.push(val);
    }
    expect(out).toEqual([1, 2, 3]);
  });
});
