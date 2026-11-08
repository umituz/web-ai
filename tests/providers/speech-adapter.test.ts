import { describe, expect, it, vi } from 'vitest';
import { createOpenAiSpeechAdapter } from '../../src/providers/audio/speech-synthesis';

describe('createOpenAiSpeechAdapter', () => {
  it('posts speech synthesis payload and returns audio buffer', async () => {
    const audioData = new Uint8Array([10, 20, 30, 40]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(audioData, {
        status: 200,
        headers: { 'content-type': 'audio/wav' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createOpenAiSpeechAdapter({
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: 'test-key',
    });

    const result = await adapter.speak({
      externalModelId: 'canopylabs/orpheus-v1-english',
      input: 'Welcome to Nexora.',
      voice: 'tara',
    });

    expect(result.audio).toEqual(audioData);
    expect(result.mimeType).toBe('audio/wav');
    vi.unstubAllGlobals();
  });

  it('throws on empty audio response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([]), {
        status: 200,
        headers: { 'content-type': 'audio/wav' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createOpenAiSpeechAdapter({
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: 'test-key',
    });

    await expect(
      adapter.speak({
        externalModelId: 'canopylabs/orpheus-v1-english',
        input: 'Test',
        voice: 'tara',
      }),
    ).rejects.toThrow('Speech synthesis returned no audio');
    vi.unstubAllGlobals();
  });
});
