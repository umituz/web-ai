import { describe, expect, it } from 'vitest';
import {
  buildUsageData,
  computeCostMicros,
  formatCost,
} from '../../src/core/calculations/usage-cost';

const pricing = { inputPerMTok: 0.15, outputPerMTok: 0.6, currency: 'USD' as const };

describe('computeCostMicros', () => {
  it('computes micro-dollar cost from per-MTok rates', () => {
    const cost = computeCostMicros(pricing, { inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(cost).toBe(750_000);
  });

  it('returns zero for empty usage', () => {
    expect(computeCostMicros(pricing, { inputTokens: 0, outputTokens: 0 })).toBe(0);
  });

  it('scales fractional usage precisely', () => {
    const cost = computeCostMicros(pricing, { inputTokens: 1_000, outputTokens: 1_000 });
    expect(cost).toBe(750);
  });
});

describe('buildUsageData', () => {
  it('normalizes reasoning tokens and rounds duration', () => {
    expect(
      buildUsageData({
        usage: { inputTokens: 10, outputTokens: 20, reasoningTokens: 5 },
        pricing,
        durationMs: 1234.7,
      }),
    ).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      reasoningTokens: 5,
      costMicros: 14,
      durationMs: 1235,
    });
  });

  it('defaults reasoning tokens to zero', () => {
    expect(
      buildUsageData({ usage: { inputTokens: 0, outputTokens: 0 }, pricing, durationMs: 0 })
        .reasoningTokens,
    ).toBe(0);
  });
});

describe('formatCost', () => {
  it('formats dollars with sensible precision', () => {
    expect(formatCost(0)).toBe('$0.00');
    expect(formatCost(750_000)).toBe('$0.75');
    expect(formatCost(750)).toBe('$0.0008');
  });
});
