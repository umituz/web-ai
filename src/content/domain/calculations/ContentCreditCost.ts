
import type { GenerationType } from '../types/GenerationTypes';
import type { ImageQuality, VideoQuality } from '../limits/ImageFormatOptions';

export type QualityTier = 'standard' | 'hd' | '4k';

export const CREDIT_COSTS: Readonly<Record<GenerationType, Readonly<Record<QualityTier, number>>>> = {
  'text-to-image':   { standard: 1, hd: 2, '4k': 4 },
  'image-to-image':  { standard: 1, hd: 2, '4k': 4 },
  'image-to-video':  { standard: 3, hd: 5, '4k': 8 },
  'text-to-video':   { standard: 5, hd: 8, '4k': 12 },
} as const;

export const DEFAULT_CREDIT_COST: number = 0;

export type AnyQuality = QualityTier | ImageQuality | VideoQuality;

export function toQualityTier(quality: AnyQuality | undefined): QualityTier {
  if (quality === '4k') return '4k';
  if (quality === 'hd' || quality === '1080p') return 'hd';
  return 'standard';
}

export function calculateContentCreditCost(
  type: GenerationType,
  quality: AnyQuality = 'standard',
): number {
  const tierCosts = CREDIT_COSTS[type];
  if (!tierCosts) return DEFAULT_CREDIT_COST;
  return tierCosts[toQualityTier(quality)] ?? tierCosts.standard;
}
