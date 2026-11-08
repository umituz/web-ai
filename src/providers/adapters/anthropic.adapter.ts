import type { TokenUsage } from '../../core/types';
import { AiError, errorFromStatus, errorFromUnknown } from '../../core/errors/unified-ai-error';
import type {
  AdapterConfig,
  AdapterRequest,
  ChatAdapter,
  ProviderEvent,
  RequestImage,
} from './adapter.types';

const ANTHROPIC_VERSION = '2023-06-01';

const ERROR_TYPE_TO_CODE: Readonly<
  Record<
    string,
    | 'invalid_request'
    | 'invalid_key'
    | 'model_unavailable'
    | 'rate_limited'
    | 'capacity'
    | 'upstream_error'
  >
> = {
  invalid_request_error: 'invalid_request',
  authentication_error: 'invalid_key',
  permission_error: 'invalid_key',
  not_found_error: 'model_unavailable',
  request_too_large: 'invalid_request',
  rate_limit_error: 'rate_limited',
  overloaded_error: 'capacity',
  api_error: 'upstream_error',
};

interface WireDelta {
  readonly type?: string;
  readonly text?: string;
  readonly thinking?: string;
}

interface WireUsage {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
}

interface WireEvent {
  readonly type?: string;
  readonly message?: { readonly usage?: WireUsage };
  readonly delta?: WireDelta;
  readonly usage?: WireUsage;
  readonly error?: { readonly type?: string; readonly message?: string };
}

type WireContentBlock =
  | { readonly type: 'text'; readonly text: string }
  | {
      readonly type: 'image';
      readonly source: {
        readonly type: 'base64';
        readonly media_type: string;
        readonly data: string;
      };
    };

type WireMessage = {
  readonly role: 'user' | 'assistant';
  readonly content: string | readonly WireContentBlock[];
};

function mergeImages(
  messages: readonly WireMessage[],
  images: readonly RequestImage[],
): WireMessage[] {
  if (images.length === 0) return [...messages];
  const blocks: readonly WireContentBlock[] = images.map((image) => ({
    type: 'image',
    source: { type: 'base64', media_type: image.mimeType, data: image.dataBase64 },
  }));
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'user') continue;
    const textBlocks: readonly WireContentBlock[] =
      typeof message.content === 'string'
        ? message.content.length > 0
          ? [{ type: 'text', text: message.content }]
          : []
        : message.content;
    return [
      ...messages.slice(0, index),
      { role: 'user', content: [...textBlocks, ...blocks] },
      ...messages.slice(index + 1),
    ];
  }
  return [...messages, { role: 'user', content: [...blocks] }];
}

async function extractErrorDetail(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { readonly error?: { readonly message?: string } };
    return body.error?.message;
  } catch {
    return undefined;
  }
}

function wireError(error: { readonly type?: string; readonly message?: string }): AiError {
  const code = (error.type && ERROR_TYPE_TO_CODE[error.type]) || 'upstream_error';
  return new AiError(code, error.message);
}

function* parseAnthropicEvent(rawEvent: string): Generator<WireEvent> {
  for (const line of rawEvent.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (payload.length === 0) continue;
    try {
      yield JSON.parse(payload) as WireEvent;
    } catch {
      continue;
    }
  }
}

function mergeOutputTokens(previous: TokenUsage | null, outputTokens: number): TokenUsage {
  return {
    inputTokens: previous?.inputTokens ?? 0,
    outputTokens,
    reasoningTokens: previous?.reasoningTokens,
  };
}

async function* parseAnthropicStream(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<ProviderEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let usage: TokenUsage | null = null;
  let usageEmitted = false;

  const flushUsage = function* (): Generator<ProviderEvent> {
    if (usage && !usageEmitted && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
      usageEmitted = true;
      yield { type: 'usage', usage };
    }
  };

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

        for (const event of parseAnthropicEvent(rawEvent)) {
          if (event.error) throw wireError(event.error);
          if (event.type === 'message_start' && event.message?.usage) {
            usage = {
              inputTokens: event.message.usage.input_tokens ?? 0,
              outputTokens: 0,
              reasoningTokens: undefined,
            };
          } else if (event.type === 'message_delta' && event.usage) {
            usage = mergeOutputTokens(usage, event.usage.output_tokens ?? 0);
          } else if (event.type === 'message_stop') {
            yield* flushUsage();
          } else if (event.delta?.type === 'text_delta' && event.delta.text) {
            yield { type: 'delta', channel: 'answer', text: event.delta.text };
          } else if (event.delta?.type === 'thinking_delta' && event.delta.thinking) {
            yield { type: 'delta', channel: 'reasoning', text: event.delta.thinking };
          }
        }
      }
    }
    yield* flushUsage();
  } catch (err) {
    throw err instanceof AiError ? err : errorFromUnknown(err);
  } finally {
    reader.releaseLock();
  }
}

export function createAnthropicAdapter(config: AdapterConfig): ChatAdapter {
  return {
    async *stream(req: AdapterRequest): AsyncIterable<ProviderEvent> {
      const timeout = AbortSignal.timeout(config.timeoutMs);
      const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;

      const system = req.messages
        .filter((message) => message.role === 'system')
        .map((message) => message.content)
        .join('\n\n');
      const messages = mergeImages(
        req.messages
          .filter((message) => message.role !== 'system')
          .map((message) => {
            if (message.role === 'user') return { role: 'user' as const, content: message.content };
            return { role: 'assistant' as const, content: message.content };
          }),
        req.images ?? [],
      );

      let response: Response;
      try {
        response = await fetch(`${config.baseUrl}/v1/messages`, {
          method: 'POST',
          headers: {
            'x-api-key': config.apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: req.externalModelId,
            messages,
            ...(system.length > 0 ? { system } : {}),
            max_tokens: req.maxOutputTokens,
            stream: true,
          }),
          signal,
        });
      } catch (err) {
        throw errorFromUnknown(err);
      }

      if (!response.ok || !response.body) {
        const detail = await extractErrorDetail(response);
        throw errorFromStatus(response.status, detail);
      }

      yield* parseAnthropicStream(response.body);
    },
  };
}
