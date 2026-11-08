import type { OpenAiCompatibleConfig } from '../embeddings/openai-embeddings';

export const SPEECH_VOICES = [
  'tara',
  'leah',
  'jess',
  'julian',
  'annie',
  'steve',
  'zac',
  'bella',
] as const;

export type SpeechVoice = (typeof SPEECH_VOICES)[number];

export const SPEECH_INPUT_MAX = 4000;

export interface SpeechRequest {
  readonly externalModelId: string;
  readonly input: string;
  readonly voice: SpeechVoice;
}

export interface SpeechResult {
  readonly audio: Uint8Array;
  readonly mimeType: string;
}

export interface SpeechAdapter {
  speak(req: SpeechRequest): Promise<SpeechResult>;
}

export function createOpenAiSpeechAdapter(config: OpenAiCompatibleConfig): SpeechAdapter {
  return {
    async speak(req: SpeechRequest): Promise<SpeechResult> {
      const response = await fetch(`${config.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: req.externalModelId,
          input: req.input,
          voice: req.voice,
          response_format: 'wav',
        }),
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
        throw new Error(detail ?? `Speech synthesis failed with HTTP ${response.status}`);
      }

      const audio = new Uint8Array(await response.arrayBuffer());
      if (audio.length === 0) throw new Error('Speech synthesis returned no audio');
      return {
        audio,
        mimeType: response.headers.get('content-type')?.split(';')[0] ?? 'audio/wav',
      };
    },
  };
}
