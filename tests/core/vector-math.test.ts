import { describe, expect, it } from 'vitest';
import {
  cosineSimilarity,
  findTopKSimilar,
  batchEmbed,
  dotProduct,
  magnitude,
} from '../../src/core/embeddings/vector-math';

describe('vector-math', () => {
  it('computes dotProduct and magnitude correctly', () => {
    expect(dotProduct([1, 2], [3, 4])).toBe(11);
    expect(magnitude([3, 4])).toBe(5);
  });

  it('computes cosineSimilarity between vectors', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(-1);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  it('findTopKSimilar ranks candidates by similarity and respects k limit', () => {
    const query = [1, 0];
    const candidates = [
      { id: 'orthogonal', vector: [0, 1], data: 'doc2' },
      { id: 'identical', vector: [2, 0], data: 'doc1' },
      { id: 'diagonal', vector: [1, 1], data: 'doc3' },
    ];

    const top = findTopKSimilar(query, candidates, 2);
    expect(top).toHaveLength(2);
    expect(top[0]?.id).toBe('identical');
    expect(top[0]?.similarity).toBeCloseTo(1, 5);
    expect(top[1]?.id).toBe('diagonal');
    expect(top[1]?.similarity).toBeCloseTo(Math.SQRT1_2, 5);
  });

  it('batchEmbed slices into chunks and aggregates vectors and tokens', async () => {
    const adapter = {
      embed: async (req: { externalModelId: string; input: string[] }) => {
        return {
          vectors: req.input.map(() => [0.1, 0.2]),
          inputTokens: req.input.length * 4,
        };
      },
    };

    const texts = ['one', 'two', 'three', 'four', 'five'];
    const result = await batchEmbed(adapter, 'text-embed', texts, 2);
    expect(result.vectors).toHaveLength(5);
    expect(result.inputTokens).toBe(20);
  });
});
