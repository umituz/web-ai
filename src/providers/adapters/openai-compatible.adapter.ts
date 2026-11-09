import { ToolCallAccumulator, type WireToolCallDelta } from '../../core/sse/tool-call-accumulator';
import { errorFromStatus, errorFromUnknown } from '../../core/errors/unified-ai-error';
import type {
  AdapterChatMessage,
  AdapterConfig,
  AdapterRequest,
  ChatAdapter,
  ProviderEvent,
  RequestImage,
} from './adapter.types';

interface WireDelta {
  readonly content?: string;
  readonly reasoning?: string;
  readonly tool_calls?: readonly WireToolCallDelta[];
}

interface WireChunk {
  readonly choices?: readonly { readonly delta?: WireDelta }[];
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
    readonly completion_tokens_details?: { readonly reasoning_tokens?: number };
  };
}

type WireContentPart =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'image_url'; readonly image_url: { readonly url: string } };

type WireMessage =
  | { readonly role: 'system' | 'assistant'; readonly content: string; readonly tool_calls?: unknown }
  | { readonly role: 'user'; readonly content: string | readonly WireContentPart[] }
  | { readonly role: 'tool'; readonly content: string; readonly tool_call_id: string };

function toWireMessage(message: AdapterChatMessage): WireMessage {
  if (message.role === 'tool') {
    return { role: 'tool', content: message.content, tool_call_id: message.toolCallId ?? '' };
  }
  if (message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0) {
    return {
      role: 'assistant',
      content: message.content,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: 'function',
        function: { name: call.name, arguments: call.arguments },
      })),
    };
  }
  if (message.role === 'user') return { role: 'user', content: message.content };
  return { role: message.role as 'system' | 'assistant', content: message.content };
}

function mergeImages(messages: readonly WireMessage[], images: readonly RequestImage[]): WireMessage[] {
  if (images.length === 0) return [...messages];
  const parts: WireContentPart[] = images.map((image) => ({
    type: 'image_url',
    image_url: { url: `data:${image.mimeType};base64,${image.dataBase64}` },
  }));
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== 'user') continue;
    const textParts: readonly WireContentPart[] =
      typeof message.content === 'string'
        ? message.content.length > 0
          ? [{ type: 'text', text: message.content }]
          : []
        : message.content;
    return [
      ...messages.slice(0, index),
      { role: 'user', content: [...textParts, ...parts] },
      ...messages.slice(index + 1),
    ];
  }
  return [...messages, { role: 'user', content: [...parts] }];
}

interface WireError {
  readonly message?: string;
  readonly type?: string;
  readonly code?: string;
}

async function extractErrorDetail(response: Response): Promise<WireError | undefined> {
  try {
    const body = (await response.json()) as { readonly error?: WireError };
    return body.error;
  } catch {
    return undefined;
  }
}

async function* parseSseEvent(
  rawEvent: string,
  toolCallAccumulator: ToolCallAccumulator,
): AsyncIterable<ProviderEvent> {
  for (const line of rawEvent.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (payload.length === 0 || payload === '[DONE]') continue;

    let chunk: WireChunk;
    try {
      chunk = JSON.parse(payload) as WireChunk;
    } catch {
      continue;
    }

    const delta = chunk.choices?.[0]?.delta;
    if (delta?.reasoning) {
      yield { type: 'delta', channel: 'reasoning', text: delta.reasoning };
    }
    if (delta?.content) {
      yield { type: 'delta', channel: 'answer', text: delta.content };
    }
    if (delta?.tool_calls) {
      for (const toolCallDelta of delta.tool_calls) toolCallAccumulator.push(toolCallDelta);
    }
    if (chunk.usage) {
      yield {
        type: 'usage',
        usage: {
          inputTokens: chunk.usage.prompt_tokens ?? 0,
          outputTokens: chunk.usage.completion_tokens ?? 0,
          reasoningTokens: chunk.usage.completion_tokens_details?.reasoning_tokens,
        },
      };
    }
  }
}

async function* parseSseStream(body: ReadableStream<Uint8Array>): AsyncIterable<ProviderEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const toolCallAccumulator = new ToolCallAccumulator();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let separator = buffer.indexOf('\n\n');
      while (separator !== -1) {
        const rawEvent = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        separator = buffer.indexOf('\n\n');
        yield* parseSseEvent(rawEvent, toolCallAccumulator);
      }
    }
  } catch (err) {
    throw errorFromUnknown(err);
  } finally {
    reader.releaseLock();
  }

  const calls = toolCallAccumulator.finish();
  if (calls.length > 0) yield { type: 'tool_calls', calls };
}

export function createOpenAiCompatibleAdapter(config: AdapterConfig): ChatAdapter {
  return {
    async *stream(req: AdapterRequest): AsyncIterable<ProviderEvent> {
      const timeout = AbortSignal.timeout(config.timeoutMs);
      const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;

      let response: Response;
      try {
        response = await fetch(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: req.externalModelId,
            messages: mergeImages(req.messages.map(toWireMessage), req.images ?? []),
            temperature: req.temperature,
            max_completion_tokens: req.maxOutputTokens,
            top_p: req.topP,
            stream: true,
            stream_options: { include_usage: true },
            ...(req.tools && req.tools.length > 0
              ? {
                  tools: req.tools.map((tool) => ({ type: 'function', function: tool })),
                  tool_choice: 'auto',
                }
              : {}),
          }),
          signal,
        });
      } catch (err) {
        throw errorFromUnknown(err);
      }

      if (!response.ok || !response.body) {
        const detail = await extractErrorDetail(response);
        throw errorFromStatus(response.status, detail?.message, detail);
      }

      yield* parseSseStream(response.body);
    },
  };
}
