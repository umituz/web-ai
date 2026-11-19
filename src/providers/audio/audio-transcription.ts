import type { OpenAiCompatibleConfig } from '../embeddings/openai-embeddings';

export interface AudioTranscriptionRequest {
  readonly externalModelId: string;
  readonly audio: Uint8Array;
  readonly mimeType: string;
  readonly name: string;
}

export interface AudioTranscriptionResult {
  readonly text: string;
}

export interface AudioTranscriptionAdapter {
  transcribe(req: AudioTranscriptionRequest): Promise<AudioTranscriptionResult>;
}

export const GROQ_OPENAI_BASE_URL = 'https://api.groq.com/openai/v1';

export const GROQ_WHISPER_MODELS = {
  LARGE_V3: 'whisper-large-v3',
  LARGE_V3_TURBO: 'whisper-large-v3-turbo',
} as const;

export type GroqWhisperModel = (typeof GROQ_WHISPER_MODELS)[keyof typeof GROQ_WHISPER_MODELS];

export interface GroqAudioTranscriptionConfig {
  readonly apiKey: string;
  readonly timeoutMs?: number;
}

export function createOpenAiAudioTranscriptionAdapter(
  config: OpenAiCompatibleConfig,
): AudioTranscriptionAdapter {
  return {
    async transcribe(req: AudioTranscriptionRequest): Promise<AudioTranscriptionResult> {
      const form = new FormData();
      form.append('file', new Blob([req.audio as BlobPart], { type: req.mimeType }), req.name);
      form.append('model', req.externalModelId);
      form.append('response_format', 'json');

      const response = await fetch(`${config.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(config.timeoutMs ?? 60_000),
      });

      if (!response.ok) {
        let detail: string | undefined;
        try {
          const body = (await response.json()) as { error?: { message?: string } };
          detail = body.error?.message;
        } catch {
          detail = undefined;
        }
        throw new Error(detail ?? `Audio transcription failed with HTTP ${response.status}`);
      }

      let body: { text?: string };
      try {
        body = (await response.json()) as { text?: string };
      } catch {
        throw new Error('Transcription response was not valid JSON');
      }
      const text = (body.text ?? '').trim();
      if (text.length === 0) throw new Error('Transcription returned no text');
      return { text };
    },
  };
}

export function createGroqAudioTranscriptionAdapter(
  config: GroqAudioTranscriptionConfig,
): AudioTranscriptionAdapter {
  return createOpenAiAudioTranscriptionAdapter({
    baseUrl: GROQ_OPENAI_BASE_URL,
    apiKey: config.apiKey,
    timeoutMs: config.timeoutMs,
  });
}
