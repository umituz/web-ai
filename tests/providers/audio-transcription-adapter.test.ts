import { describe, expect, it, vi } from 'vitest';
import { createOpenAiAudioTranscriptionAdapter } from '../../src/providers/audio/audio-transcription';

describe('createOpenAiAudioTranscriptionAdapter', () => {
  it('sends audio file as FormData and returns text', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ text: 'Hello from speech audio.' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createOpenAiAudioTranscriptionAdapter({
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: 'test-key',
    });

    const result = await adapter.transcribe({
      externalModelId: 'whisper-large-v3-turbo',
      audio: new Uint8Array([1, 2, 3]),
      mimeType: 'audio/wav',
      name: 'sample.wav',
    });

    expect(result.text).toBe('Hello from speech audio.');
    vi.unstubAllGlobals();
  });

  it('throws on empty text output', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ text: '   ' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createOpenAiAudioTranscriptionAdapter({
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: 'test-key',
    });

    await expect(
      adapter.transcribe({
        externalModelId: 'whisper-large-v3-turbo',
        audio: new Uint8Array([1, 2, 3]),
        mimeType: 'audio/wav',
        name: 'sample.wav',
      }),
    ).rejects.toThrow('Transcription returned no text');
    vi.unstubAllGlobals();
  });
});
