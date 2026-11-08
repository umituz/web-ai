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
