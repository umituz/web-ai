import { AiError, errorFromStatus, errorFromUnknown } from '../errors/unified-ai-error';

export type SearchTopic = 'general' | 'news';

export interface WebSearchResult {
  readonly title: string;
  readonly url: string;
  readonly content: string;
  readonly score: number | null;
}

export interface WebSearchResponse {
  readonly query: string;
  readonly answer: string | null;
  readonly results: ReadonlyArray<WebSearchResult>;
  readonly responseTime: number | null;
}

export interface WebSearchInput {
  readonly query: string;
  readonly maxResults?: number;
  readonly topic?: SearchTopic;
  readonly includeAnswer?: boolean;
}

export type FetchLike = (input: string, init: Record<string, unknown>) => Promise<Response>;

interface TavilyResult {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  score?: unknown;
}

interface TavilyResponse {
  query?: unknown;
  answer?: unknown;
  response_time?: unknown;
  results?: unknown;
}

export const SEARCH_MAX_RESULTS = 5;

export async function searchWeb(
  env: { readonly TAVILY_API_KEY?: string; readonly TAVILY_BASE_URL?: string },
  input: WebSearchInput,
  fetchImpl: FetchLike = fetch,
): Promise<WebSearchResponse> {
  const apiKey = env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new AiError('missing_key');
  }

  const maxResults = Math.min(
    Math.max(Math.trunc(input.maxResults ?? SEARCH_MAX_RESULTS), 1),
    SEARCH_MAX_RESULTS,
  );
  const topic = input.topic ?? 'general';
  const baseUrl = (env.TAVILY_BASE_URL ?? 'https://api.tavily.com').replace(/\/$/, '');

  const body: Record<string, unknown> = { query: input.query, max_results: maxResults, topic };
  if (input.includeAnswer) body.include_answer = true;

  let res: Response;
  try {
    res = await fetchImpl(`${baseUrl}/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw errorFromUnknown(err);
  }

  if (!res.ok) {
    let detail: string | undefined;
    try {
      const parsed = (await res.json()) as { detail?: unknown };
      const detailField = parsed?.detail;
      if (Array.isArray(detailField)) {
        detail = 'validation failed';
      } else if (detailField && typeof detailField === 'object' && 'error' in detailField) {
        const errorValue = (detailField as { error: unknown }).error;
        if (typeof errorValue === 'string') detail = errorValue;
      } else if (typeof detailField === 'string') {
        detail = detailField;
      }
    } catch {
      detail = undefined;
    }
    throw errorFromStatus(res.status, detail);
  }

  try {
    const parsed = (await res.json()) as TavilyResponse;
    const rawResults = Array.isArray(parsed.results) ? (parsed.results as TavilyResult[]) : [];
    const results = rawResults
      .filter((row) => typeof row.url === 'string' && row.url.length > 0)
      .map((row) => ({
        title: typeof row.title === 'string' ? row.title : '',
        url: row.url as string,
        content: typeof row.content === 'string' ? row.content : '',
        score: typeof row.score === 'number' ? row.score : null,
      }));

    return {
      query: typeof parsed.query === 'string' ? parsed.query : input.query,
      answer: typeof parsed.answer === 'string' ? parsed.answer : null,
      results,
      responseTime: typeof parsed.response_time === 'number' ? parsed.response_time : null,
    };
  } catch (err) {
    throw errorFromUnknown(err);
  }
}
