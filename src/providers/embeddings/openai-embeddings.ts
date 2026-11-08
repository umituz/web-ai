export interface EmbeddingsRequest {
  readonly externalModelId: string;
  readonly input: ReadonlyArray<string>;
}

export interface EmbeddingsResult {
  readonly vectors: number[][];
  readonly inputTokens: number | null;
}

export interface EmbeddingsAdapter {
  embed(req: EmbeddingsRequest): Promise<EmbeddingsResult>;
}

export interface OpenAiCompatibleConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly timeoutMs?: number;
}

interface WireItem {
  index?: unknown;
  embedding?: unknown;
}

interface WireResponse {
  data?: WireItem[];
  usage?: { prompt_tokens?: unknown; total_tokens?: unknown };
  error?: { message?: unknown };
}

const DEFAULT_EMBED_TIMEOUT_MS = 60_000;

export function createOpenAiEmbeddingsAdapter(config: OpenAiCompatibleConfig): EmbeddingsAdapter {
  return {
    async embed(req: EmbeddingsRequest): Promise<EmbeddingsResult> {
      const response = await fetch(`${config.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: req.externalModelId, input: req.input }),
        signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_EMBED_TIMEOUT_MS),
      });

      if (!response.ok) {
        let detail: string | undefined;
        try {
          const parsed = (await response.json()) as WireResponse;
          detail = typeof parsed.error?.message === 'string' ? parsed.error.message : undefined;
        } catch {
          detail = undefined;
        }
        throw new Error(detail ?? `Embeddings upstream failed with HTTP ${response.status}`);
      }

      const parsed = (await response.json()) as WireResponse;
      const items = Array.isArray(parsed.data) ? parsed.data : [];
      const byIndex = new Map<number, number[]>();
      for (const item of items) {
        if (typeof item.index !== 'number' || !Array.isArray(item.embedding)) continue;
        byIndex.set(item.index, item.embedding as number[]);
      }
      const vectors: number[][] = [];
      for (let i = 0; i < req.input.length; i += 1) {
        const vector = byIndex.get(i);
        if (!vector) throw new Error('Provider returned an incomplete embeddings batch');
        vectors.push(vector);
      }

      const inputTokens =
        typeof parsed.usage?.prompt_tokens === 'number'
          ? (parsed.usage.prompt_tokens as number)
          : null;
      return { vectors, inputTokens };
    },
  };
}
