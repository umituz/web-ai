import { describe, expect, it, vi } from 'vitest';
import {
  createOpenAiAudioTranscriptionAdapter,
  createGroqAudioTranscriptionAdapter,
  GROQ_OPENAI_BASE_URL,
  GROQ_WHISPER_MODELS,
} from '../../src/providers/audio/audio-transcription';

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

describe('createGroqAudioTranscriptionAdapter', () => {
  it('exposes correct Groq base URL and whisper model constants', () => {
    expect(GROQ_OPENAI_BASE_URL).toBe('https://api.groq.com/openai/v1');
    expect(GROQ_WHISPER_MODELS.LARGE_V3).toBe('whisper-large-v3');
    expect(GROQ_WHISPER_MODELS.LARGE_V3_TURBO).toBe('whisper-large-v3-turbo');
  });

  it('delegates to open ai transcription with groq base url', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ text: 'Groq audio transcribed text.' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createGroqAudioTranscriptionAdapter({
      apiKey: 'groq-test-key',
    });

    const result = await adapter.transcribe({
      externalModelId: GROQ_WHISPER_MODELS.LARGE_V3,
      audio: new Uint8Array([4, 5, 6]),
      mimeType: 'audio/webm',
      name: 'speaking.webm',
    });

    expect(result.text).toBe('Groq audio transcribed text.');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    vi.unstubAllGlobals();
  });
});
