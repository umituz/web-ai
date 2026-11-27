import { AiError, errorFromUnknown } from '../../core/errors/unified-ai-error';
import type {
  AdapterChatMessage,
  AdapterRequest,
  ChatAdapter,
  ProviderEvent,
} from './adapter.types';
import type { WorkersAIBinding, WorkersAIMessage } from '../workers-ai/workers-ai.entities';

export const WORKERS_AI_CHAT_TIMEOUT_MS = 60_000;

/**
 * Llama-3.3 70B on Workers AI serves a ~6.4k-token context; the adapter
 * reports a conservative window so `runConversation`'s `buildContext`
 * windowing keeps prompts inside the deployment's real limit.
 */
export const WORKERS_AI_CONTEXT_WINDOW = 6000;

export interface WorkersAIChatAdapterOptions {
  readonly timeoutMs?: number;
}

function toWorkersAIMessages(messages: readonly AdapterChatMessage[]): WorkersAIMessage[] {
  const systemParts: string[] = [];
  const turns: WorkersAIMessage[] = [];
  for (const message of messages) {
    if (message.role === 'system') {
      if (message.content.length > 0) systemParts.push(message.content);
      continue;
    }
    if (message.role === 'tool') {
      turns.push({ role: 'user', content: `Tool result: ${message.content}` });
      continue;
    }
    const toolNote =
      message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0
        ? `\n\nRequested tools: ${message.toolCalls.map((call) => call.name).join(', ')}`
        : '';
    turns.push({ role: message.role, content: `${message.content}${toolNote}` });
  }
  const system = systemParts.join('\n\n');
  return system.length > 0 ? [{ role: 'system', content: system }, ...turns] : turns;
}

function requireBinding(binding: WorkersAIBinding | undefined | null): WorkersAIBinding {
  if (!binding || typeof binding.run !== 'function') {
    throw new AiError('missing_key', 'Workers AI binding (env.AI) is not configured');
  }
  return binding;
}

async function openStream(
  binding: WorkersAIBinding,
  req: AdapterRequest,
  timeoutMs: number,
): Promise<ReadableStream<Uint8Array>> {
  let body: unknown;
  try {
    body = await Promise.race([
      binding.run(req.externalModelId, {
        messages: toWorkersAIMessages(req.messages),
        stream: true,
        ...(req.maxOutputTokens !== undefined ? { max_tokens: req.maxOutputTokens } : {}),
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        ...(req.topP !== undefined ? { top_p: req.topP } : {}),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new AiError('timeout', 'Workers AI timed out')), timeoutMs),
      ),
    ]);
  } catch (err) {
    throw err instanceof AiError ? err : errorFromUnknown(err);
  }

  const stream = body as { getReader?: () => ReadableStreamDefaultReader<Uint8Array> } | ReadableStream;
  const getReader =
    typeof stream === 'object' && stream !== null && 'getReader' in stream && typeof stream.getReader === 'function'
      ? stream.getReader
      : undefined;
  if (!getReader) {
    throw new AiError('upstream_error', 'Workers AI stream was not readable');
  }
  return stream as ReadableStream<Uint8Array>;
}

async function* parseWorkersAIStream(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<ProviderEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineAt: number;
      while ((newlineAt = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineAt);
        buffer = buffer.slice(newlineAt + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') return;
        try {
          const parsed = JSON.parse(payload) as { response?: unknown };
          if (typeof parsed.response === 'string' && parsed.response.length > 0) {
            yield { type: 'delta', channel: 'answer', text: parsed.response };
          }
        } catch {
          buffer = `${line}\n${buffer}`;
          break;
        }
      }
    }
  } catch (err) {
    throw err instanceof AiError ? err : errorFromUnknown(err);
  } finally {
    reader.releaseLock();
  }
}

/**
 * ChatAdapter over the Cloudflare `env.AI` binding — the binding-driven
 * twin of `createAnthropicAdapter`/`createOpenAiCompatibleAdapter`. Slots
 * the zero-key Workers AI provider into `runConversation` attempt chains
 * (failover, context windowing, event reduction) like any HTTP provider.
 * Text-only: tools and images are folded to plain text, never offered.
 */
export function createWorkersAIChatAdapter(
  binding: WorkersAIBinding | undefined | null,
  options: WorkersAIChatAdapterOptions = {},
): ChatAdapter {
  const timeoutMs = options.timeoutMs ?? WORKERS_AI_CHAT_TIMEOUT_MS;
  return {
    async *stream(req: AdapterRequest): AsyncIterable<ProviderEvent> {
      const live = requireBinding(binding);
      const body = await openStream(live, req, timeoutMs);
      yield* parseWorkersAIStream(body);
    },
  };
}
