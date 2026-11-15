
import type { ChatMessage } from '../../core/types';
import { WorkersAIError, type WorkersAIEnv, type WorkersAIMessage } from './workers-ai.entities';

/**
 * Workers AI text client over the `env.AI` binding — non-streaming run()
 * plus the streaming twin, both hardened against the deployment quirks the
 * production ports (storyora STYLORA lane) documented:
 *
 *   1. The fp8-fast deployments answer in BOTH shapes — the documented
 *      legacy `{response}` mirror AND an OpenAI chat.completion body — and
 *      the mirror has been observed MISSING on a second sequential call in
 *      one invocation. Read either shape, legacy first.
 *   2. Streaming answers as SSE frames (`data: {"response": "…"} …
 *      data: [DONE]`); a JSON payload can split across chunk boundaries, so
 *      the parser pushes an unparseable line back and waits for more bytes.
 */

/** Speed-optimized 70b instruct — the default. If p95 latency hurts, drop
 *  to "@cf/meta/llama-3.1-8b-instruct-fp8-fast" (one line). */
export const WORKERS_AI_LLM_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const WORKERS_AI_TEXT_TIMEOUT_MS = 25_000;

export interface WorkersAITextOptions {
  maxTokens?: number;
  temperature?: number;
  /** Explicit model id — wins over the default. */
  model?: string;
}

/** The text lane is live only when the AI binding was injected. */
export function workersAIConfigured(env: WorkersAIEnv): boolean {
  return typeof env.AI?.run === 'function';
}

/** Guarded binding accessor — narrows away the optional for call sites. */
function requireAi(env: WorkersAIEnv): NonNullable<WorkersAIEnv['AI']> {
  const ai = env.AI;
  if (!ai || typeof ai.run !== 'function') throw new WorkersAIError('Workers AI is not configured');
  return ai;
}

/** One provider call with a timeout — resolves the non-streaming text by
 *  reading both documented response shapes. Throws WorkersAIError on any
 *  failure, including an empty reply. */
export async function runWorkersAIText(
  env: WorkersAIEnv,
  messages: ReadonlyArray<ChatMessage | WorkersAIMessage>,
  opts: WorkersAITextOptions = {},
): Promise<string> {
  const ai = requireAi(env);
  const model = opts.model ?? WORKERS_AI_LLM_MODEL;
  let result: unknown;
  try {
    result = await Promise.race([
      ai.run(model, {
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: opts.maxTokens ?? 900,
        temperature: opts.temperature ?? 0.7,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new WorkersAIError('Workers AI timed out')), WORKERS_AI_TEXT_TIMEOUT_MS),
      ),
    ]);
  } catch (err) {
    throw err instanceof WorkersAIError
      ? err
      : new WorkersAIError(err instanceof Error ? err.message : 'Workers AI request failed');
  }
  const response = (result ?? {}) as {
    response?: unknown;
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  // Legacy {response} mirror first, OpenAI chat.completion body second —
  // see the module notes for why the order is load-bearing.
  let text: unknown = response.response;
  if (typeof text !== 'string' || text.length === 0) {
    text = response.choices?.[0]?.message?.content;
  }
  if (typeof text !== 'string' || text.length === 0) {
    throw new WorkersAIError('Workers AI returned no text');
  }
  return text;
}

/**
 * Streaming twin — yields incremental tokens off the provider's SSE stream.
 * Frame parsing mirrors typical client-side SSE readers (buffered lines, \r
 * trimming, comment skip) so both ends tolerate the same wire quirks.
 */
export async function* streamWorkersAIText(
  env: WorkersAIEnv,
  messages: ReadonlyArray<ChatMessage | WorkersAIMessage>,
  opts: WorkersAITextOptions = {},
): AsyncGenerator<string> {
  const ai = requireAi(env);
  const model = opts.model ?? WORKERS_AI_LLM_MODEL;
  let body: unknown;
  try {
    body = await Promise.race([
      ai.run(model, {
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        max_tokens: opts.maxTokens ?? 600,
        temperature: opts.temperature ?? 0.7,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new WorkersAIError('Workers AI timed out')), WORKERS_AI_TEXT_TIMEOUT_MS),
      ),
    ]);
  } catch (err) {
    throw err instanceof WorkersAIError
      ? err
      : new WorkersAIError(err instanceof Error ? err.message : 'Workers AI request failed');
  }
  const stream = body as { getReader?: () => ReadableStreamDefaultReader<Uint8Array> } | ReadableStream;
  const getReader =
    typeof stream === 'object' && stream !== null && 'getReader' in stream && typeof stream.getReader === 'function'
      ? stream.getReader
      : undefined;
  if (!getReader) throw new WorkersAIError('Workers AI stream was not readable');

  const reader = (getReader as () => ReadableStreamDefaultReader<Uint8Array>).call(stream);
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
          if (typeof parsed.response === 'string' && parsed.response.length > 0) yield parsed.response;
        } catch {
          // Partial JSON split across chunks — push back and wait for more.
          buffer = `${line}\n${buffer}`;
          break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
