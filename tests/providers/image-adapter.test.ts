import { describe, expect, it, vi } from 'vitest';
import { createOpenAiImageAdapter } from '../../src/providers/images/openai-images';

describe('createOpenAiImageAdapter', () => {
  it('posts image generation request and parses base64 results with usage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' }],
          usage: { input_tokens: 12, output_tokens: 100 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createOpenAiImageAdapter({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key',
    });

    const result = await adapter.generate({
      externalModelId: 'dall-e-3',
      prompt: 'A golden retriever in a field',
      size: '1024x1024',
      quality: 'standard',
    });

    expect(result.images).toHaveLength(1);
    expect(result.usage).toEqual({
      inputTokens: 12,
      outputTokens: 100,
      totalTokens: 112,
    });
    vi.unstubAllGlobals();
  });

  it('throws on empty images array', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: [] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createOpenAiImageAdapter({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key',
    });

    await expect(
      adapter.generate({
        externalModelId: 'dall-e-3',
        prompt: 'Prompt',
        size: '1024x1024',
        quality: 'standard',
      }),
    ).rejects.toThrow('returned no image data');
    vi.unstubAllGlobals();
  });
});
