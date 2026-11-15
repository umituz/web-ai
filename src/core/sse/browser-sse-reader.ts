export interface StreamCallbacks<TToolCall = unknown> {
  onDelta(channel: 'answer' | 'reasoning', text: string): void;
  onUsage?(usage: { inputTokens: number; outputTokens: number; reasoningTokens?: number }): void;
  onToolCall?(toolCall: TToolCall): void;
  onDone?(messageId: string): void;
  onError?(code: string, message: string): void;
}

export type ParsedSseEvent<TToolCall = unknown> =
  | { readonly type: 'delta'; readonly channel: 'answer' | 'reasoning'; readonly text: string }
  | {
      readonly type: 'usage';
      readonly usage: {
        readonly inputTokens: number;
        readonly outputTokens: number;
        readonly reasoningTokens?: number;
      };
    }
  | { readonly type: 'tool_call'; readonly toolCall: TToolCall }
  | { readonly type: 'done'; readonly messageId: string }
  | { readonly type: 'error'; readonly code: string; readonly message: string };

export function parseSseEvent<TToolCall = unknown>(
  rawEvent: string,
): ParsedSseEvent<TToolCall> | null {
  let data: string | null = null;
  for (const line of rawEvent.split('\n')) {
    if (line.startsWith('data:')) {
      data = line.slice(5).trim();
    }
  }
  if (!data) return null;
  try {
    return JSON.parse(data) as ParsedSseEvent<TToolCall>;
  } catch {
    return null;
  }
}

function dispatchSseEvent<TToolCall>(
  event: ParsedSseEvent<TToolCall>,
  callbacks: StreamCallbacks<TToolCall>,
): void {
  switch (event.type) {
    case 'delta':
      callbacks.onDelta(event.channel, event.text);
      break;
    case 'usage':
      callbacks.onUsage?.(event.usage);
      break;
    case 'tool_call':
      callbacks.onToolCall?.(event.toolCall);
      break;
    case 'done':
      callbacks.onDone?.(event.messageId);
      break;
    case 'error':
      callbacks.onError?.(event.code, event.message);
      break;
  }
}

export async function readSseResponse<TToolCall = unknown>(
  response: Response,
  callbacks: StreamCallbacks<TToolCall>,
): Promise<void> {
  if (!response.body) {
    callbacks.onError?.('request_failed', 'The server returned an empty stream.');
    return;
  }

  for await (const event of iterateSseJson<ParsedSseEvent<TToolCall>>(response)) {
    if (event) dispatchSseEvent(event, callbacks);
  }
}

/* ---------- generic SSE data-frame layer ----------
   Protocol-generic: yields an event's data payload with zero vocabulary
   of its own, so any JSON-over-SSE protocol consumes it without the
   provider-specific ParsedSseEvent shapes above. */

/** The joined `data:` payload of one SSE frame, or null when the frame
 *  carries none (or only empty payloads). Multiple data lines concatenate
 *  with '\n' per the SSE spec. */
function dataPayloadOf(frame: string): string | null {
  let data: string | null = null;
  for (const line of frame.split('\n')) {
    if (line.startsWith('data:')) {
      const payload = line.slice(5).trim();
      data = data === null ? payload : `${data}\n${payload}`;
    }
  }
  return data !== null && data.length > 0 ? data : null;
}

/** Yield each SSE event's data payload from a Response (or its raw body).
 *  A payload split across network chunks reassembles before it yields;
 *  frames without data never surface. The reader is always released AND
 *  the body cancelled — including when the consumer breaks out of the
 *  loop early, throws inside it, or the stream errors mid-read. */
export async function* iterateSseData(
  source: Response | ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const body = source instanceof Response ? source.body : source;
  if (!body) {
    throw new Error('iterateSseData: the response has no body to read');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');
        const data = dataPayloadOf(frame);
        if (data) yield data;
      }
    }
  } finally {
    // cancel(), not just releaseLock(): an abandoned iteration must drop
    // the connection instead of leaving it to drain in the background.
    await reader.cancel().catch(() => undefined);
  }
}

/** iterateSseData + JSON.parse: yields T per frame and skips frames that
 *  don't parse — one malformed frame never kills the stream; the next
 *  frame boundary resyncs it. */
export async function* iterateSseJson<T>(
  source: Response | ReadableStream<Uint8Array>,
): AsyncGenerator<T> {
  for await (const data of iterateSseData(source)) {
    try {
      yield JSON.parse(data) as T;
    } catch {
      // Unparseable frame — skip it.
    }
  }
}
