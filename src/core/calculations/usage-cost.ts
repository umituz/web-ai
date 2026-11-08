import type { TokenUsage } from '../types';

export const MICROS_PER_UNIT = 1_000_000;

export interface ModelPricing {
  readonly inputPerMTok: number;
  readonly outputPerMTok: number;
  readonly currency: 'USD';
}

export function computeCostMicros(
  pricing: ModelPricing,
  usage: Pick<TokenUsage, 'inputTokens' | 'outputTokens'>,
): number {
  const inputCost = (usage.inputTokens / MICROS_PER_UNIT) * pricing.inputPerMTok;
  const outputCost = (usage.outputTokens / MICROS_PER_UNIT) * pricing.outputPerMTok;
  return Math.round((inputCost + outputCost) * MICROS_PER_UNIT);
}

export interface UsageRecordInput {
  readonly usage: TokenUsage & { readonly reasoningTokens?: number };
  readonly pricing: ModelPricing;
  readonly durationMs: number;
}

export interface UsageRecordData {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly reasoningTokens: number;
  readonly costMicros: number;
  readonly durationMs: number;
}

export function buildUsageData(input: UsageRecordInput): UsageRecordData {
  return {
    inputTokens: input.usage.inputTokens,
    outputTokens: input.usage.outputTokens,
    reasoningTokens: input.usage.reasoningTokens ?? 0,
    costMicros: computeCostMicros(input.pricing, input.usage),
    durationMs: Math.round(input.durationMs),
  };
}

export function formatCost(costMicros: number): string {
  if (costMicros === 0) return '$0.00';
  const dollars = costMicros / MICROS_PER_UNIT;
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
  return `$${dollars.toFixed(2)}`;
}
