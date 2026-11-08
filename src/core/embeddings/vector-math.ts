export interface EmbeddingsBatchAdapter {
  embed(req: { externalModelId: string; input: string[] }): Promise<{
    vectors: number[][];
    inputTokens: number | null;
  }>;
}

export const DEFAULT_EMBED_BATCH_SIZE = 32;

export async function batchEmbed(
  adapter: EmbeddingsBatchAdapter,
  externalModelId: string,
  texts: readonly string[],
  batchSize: number = DEFAULT_EMBED_BATCH_SIZE,
): Promise<{ vectors: number[][]; inputTokens: number | null }> {
  const safeBatchSize = Math.max(Math.trunc(batchSize), 1);
  const vectors: number[][] = [];
  let inputTokens = 0;
  let sawTokens = false;

  for (let offset = 0; offset < texts.length; offset += safeBatchSize) {
    const batch = texts.slice(offset, offset + safeBatchSize);
    const result = await adapter.embed({ externalModelId, input: batch as string[] });
    vectors.push(...result.vectors);
    if (result.inputTokens !== null && result.inputTokens !== undefined) {
      inputTokens += result.inputTokens;
      sawTokens = true;
    }
  }

  return { vectors, inputTokens: sawTokens ? inputTokens : null };
}

export function dotProduct(a: readonly number[], b: readonly number[]): number {
  const length = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < length; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

export function magnitude(v: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < v.length; i += 1) {
    sum += v[i] * v[i];
  }
  return Math.sqrt(sum);
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

export interface VectorCandidate<T = unknown> {
  readonly id: string;
  readonly vector: readonly number[];
  readonly data?: T;
}

export interface VectorMatch<T = unknown> {
  readonly id: string;
  readonly similarity: number;
  readonly data?: T;
}

export function findTopKSimilar<T = unknown>(
  queryVector: readonly number[],
  candidates: readonly VectorCandidate<T>[],
  k: number = 8,
): VectorMatch<T>[] {
  const scored = candidates.map((candidate) => ({
    id: candidate.id,
    similarity: cosineSimilarity(queryVector, candidate.vector),
    data: candidate.data,
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, Math.max(k, 0));
}
