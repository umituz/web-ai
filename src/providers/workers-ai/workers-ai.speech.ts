
import { WorkersAIError, type WorkersAIEnv } from './workers-ai.entities';

/**
 * Workers AI speech client — text-to-speech over the same `env.AI` binding.
 *
 * Wire shapes (verified against the Workers AI catalog):
 *   aura-2-*  → ai.run(model, { text })         → ReadableStream of mp3 bytes
 *   melotts   → ai.run(model, { prompt, lang }) → { audio: "base64…" }
 *
 * The binding call itself has no abort — the timeout races the promise and
 * the loser simply stops being awaited.
 */

const WORKERS_AI_SPEECH_TIMEOUT_MS = 45_000;

/** Engine descriptor: the catalog id plus melotts's langParam, when a
 *  model takes one ("tr", "en", …). */
export interface WorkersAISpeechEngine {
  model: string;
  langParam?: string;
}

export interface WorkersAISpeechResult {
  /** mp3 bytes — every verified engine answers audio/mpeg. */
  bytes: Uint8Array;
}

/** Collect a byte stream into one buffer. */
async function readAll(stream: ReadableStream): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return combined;
}

/** base64 → bytes, chunk-safe at byte() call arity. */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** One engine call — resolves mp3 bytes. Throws WorkersAIError on timeout,
 *  transport failure or an empty/foreign-shaped reply. */
export async function speakWithWorkersAI(
  env: WorkersAIEnv,
  engine: WorkersAISpeechEngine,
  text: string,
): Promise<WorkersAISpeechResult> {
  const ai = env.AI;
  if (!ai || typeof ai.run !== 'function') throw new WorkersAIError('Workers AI is not configured');
  const input: Record<string, unknown> = engine.langParam ? { prompt: text, lang: engine.langParam } : { text };
  let result: unknown;
  try {
    result = await Promise.race([
      ai.run(engine.model, input),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new WorkersAIError('The speech engine timed out')), WORKERS_AI_SPEECH_TIMEOUT_MS),
      ),
    ]);
  } catch (err) {
    throw err instanceof WorkersAIError
      ? err
      : new WorkersAIError(err instanceof Error ? err.message : 'Workers AI speech request failed');
  }

  if (result instanceof ReadableStream) {
    const bytes = await readAll(result);
    if (bytes.length === 0) throw new WorkersAIError('The speech engine returned no audio');
    return { bytes };
  }

  const audio = (result ?? {}) as { audio?: unknown };
  if (typeof audio.audio === 'string' && audio.audio.length > 0) {
    return { bytes: base64ToBytes(audio.audio) };
  }
  throw new WorkersAIError('The speech engine returned no audio');
}
