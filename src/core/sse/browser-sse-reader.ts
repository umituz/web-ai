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

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separator = buffer.indexOf('\n\n');
    while (separator !== -1) {
      const rawEvent = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      separator = buffer.indexOf('\n\n');
      const event = parseSseEvent<TToolCall>(rawEvent);
      if (!event) continue;
      dispatchSseEvent(event, callbacks);
    }
  }
}
