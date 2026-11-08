import { describe, expect, it } from 'vitest';
import { type FetchLike, searchWeb } from '../../src/core/search/web-search';

describe('searchWeb', () => {
  it('throws when TAVILY_API_KEY is missing', async () => {
    await expect(searchWeb({}, { query: 'test' })).rejects.toMatchObject({
      code: 'missing_key',
    });
  });

  it('parses valid Tavily response and normalizes results', async () => {
    const mockFetch: FetchLike = async () => {
      return new Response(
        JSON.stringify({
          query: 'TypeScript 5',
          answer: 'TypeScript 5 is great.',
          response_time: 0.42,
          results: [
            {
              title: 'TS 5 Announcement',
              url: 'https://devblogs.microsoft.com/typescript',
              content: 'Announcing TypeScript 5...',
              score: 0.98,
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

    const res = await searchWeb(
      { TAVILY_API_KEY: 'test-key' },
      { query: 'TypeScript 5', includeAnswer: true },
      mockFetch,
    );

    expect(res.query).toBe('TypeScript 5');
    expect(res.answer).toBe('TypeScript 5 is great.');
    expect(res.responseTime).toBe(0.42);
    expect(res.results).toHaveLength(1);
    expect(res.results[0].title).toBe('TS 5 Announcement');
  });

  it('handles HTTP error gracefully', async () => {
    const mockFetch: FetchLike = async () => {
      return new Response(
        JSON.stringify({ detail: 'Invalid API key provided' }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      );
    };

    await expect(
      searchWeb({ TAVILY_API_KEY: 'bad-key' }, { query: 'test' }, mockFetch),
    ).rejects.toThrow('Invalid API key provided');
  });
});
