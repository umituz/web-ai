import { describe, expect, it, vi } from 'vitest';
import { createOpenAiEmbeddingsAdapter } from '../../src/providers/embeddings/openai-embeddings';

describe('createOpenAiEmbeddingsAdapter', () => {
  it('sends embeddings request and preserves index ordering', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { index: 1, embedding: [0.1, 0.2] },
            { index: 0, embedding: [0.3, 0.4] },
          ],
          usage: { prompt_tokens: 15 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createOpenAiEmbeddingsAdapter({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key',
    });

    const result = await adapter.embed({
      externalModelId: 'text-embedding-3-small',
      input: ['first', 'second'],
    });

    expect(result.vectors).toEqual([
      [0.3, 0.4],
      [0.1, 0.2],
    ]);
    expect(result.inputTokens).toBe(15);
    vi.unstubAllGlobals();
  });

  it('throws on incomplete batch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ index: 0, embedding: [0.3, 0.4] }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createOpenAiEmbeddingsAdapter({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key',
    });

    await expect(
      adapter.embed({
        externalModelId: 'text-embedding-3-small',
        input: ['first', 'second'],
      }),
    ).rejects.toThrow('incomplete embeddings batch');
    vi.unstubAllGlobals();
  });
});
