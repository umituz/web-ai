import { describe, expect, it } from 'vitest';
import {
  calculateContentCreditCost,
  CREDIT_COSTS,
  toQualityTier,
} from '../../../src/content/domain/calculations/ContentCreditCost';
import { calculateRetryBackoffDelayMs } from '../../../src/content/domain/calculations/RetryBackoffDelay';
import { resolveDimensionsForAspectRatio } from '../../../src/content/domain/calculations/AspectRatioDimensions';
import {
  calculateKeywordDensity,
  countKeywordOccurrences,
  countWordsInContent,
} from '../../../src/content/domain/calculations/SeoKeywordDensity';
import {
  estimateTokenBudgetForDuration,
  estimateWordCountForDuration,
} from '../../../src/content/domain/calculations/SpeechPaceEstimate';
import { calculateImprovementPercentage } from '../../../src/content/domain/calculations/AbTestImprovementRatio';
import { resolveDefaultPrunaModel } from '../../../src/content/domain/calculations/DefaultModelSelection';
import { resolveCalendarEntryDate } from '../../../src/content/domain/calculations/ContentCalendarDateOffset';

describe('calculateContentCreditCost', () => {
  it('prices every generation type by tier', () => {
    expect(calculateContentCreditCost('text-to-image', 'standard')).toBe(1);
    expect(calculateContentCreditCost('text-to-image', 'hd')).toBe(2);
    expect(calculateContentCreditCost('text-to-image', '4k')).toBe(4);
    expect(calculateContentCreditCost('text-to-video', 'standard')).toBe(5);
    expect(calculateContentCreditCost('image-to-video', 'hd')).toBe(5);
  });

  it('normalizes video quality vocabularies into pricing tiers', () => {
    expect(calculateContentCreditCost('text-to-video', '720p')).toBe(5);
    expect(calculateContentCreditCost('text-to-video', '1080p')).toBe(8);
    expect(calculateContentCreditCost('text-to-video', '4k')).toBe(12);
  });

  it('defaults to standard tier when quality is omitted', () => {
    expect(calculateContentCreditCost('image-to-image')).toBe(1);
  });

  it('toQualityTier maps every vocabulary deterministically', () => {
    expect(toQualityTier('standard')).toBe('standard');
    expect(toQualityTier('hd')).toBe('hd');
    expect(toQualityTier('4k')).toBe('4k');
    expect(toQualityTier('720p')).toBe('standard');
    expect(toQualityTier('1080p')).toBe('hd');
    expect(toQualityTier(undefined)).toBe('standard');
  });

  it('exposes a complete cost table', () => {
    for (const tiers of Object.values(CREDIT_COSTS)) {
      expect(tiers.standard).toBeGreaterThan(0);
      expect(tiers.hd).toBeGreaterThan(0);
      expect(tiers['4k']).toBeGreaterThan(0);
    }
  });
});

describe('calculateRetryBackoffDelayMs', () => {
  it('grows exponentially with the attempt index', () => {
    const base = calculateRetryBackoffDelayMs(0);
    expect(calculateRetryBackoffDelayMs(1)).toBe(base * 2);
    expect(calculateRetryBackoffDelayMs(2)).toBe(base * 4);
  });
});

describe('resolveDimensionsForAspectRatio', () => {
  it('resolves known ratios to pixel dimensions', () => {
    expect(resolveDimensionsForAspectRatio('1:1')).toEqual({ width: 1024, height: 1024 });
    expect(resolveDimensionsForAspectRatio('16:9')).toEqual({ width: 1920, height: 1080 });
  });

  it('falls back for unknown ratios', () => {
    const fallback = resolveDimensionsForAspectRatio('21:9' as never);
    expect(fallback.width).toBeGreaterThan(0);
    expect(fallback.height).toBeGreaterThan(0);
  });
});

describe('SEO keyword math', () => {
  it('counts keyword occurrences case-insensitively and escapes regex metacharacters', () => {
    expect(countKeywordOccurrences('AI is great. ai rocks!', 'ai')).toBe(2);
    expect(countKeywordOccurrences('a.b a.b', 'a.b')).toBe(2);
    expect(countKeywordOccurrences('anything', '')).toBe(0);
  });

  it('counts words', () => {
    expect(countWordsInContent('one two three')).toBe(3);
    expect(countWordsInContent('')).toBe(1);
  });

  it('computes density as a percentage', () => {
    expect(calculateKeywordDensity('ai is ai great', 'ai')).toBeCloseTo(50);
  });
});

describe('speech pace estimates', () => {
  it('estimates word count and token budget from duration', () => {
    expect(estimateWordCountForDuration(10)).toBeGreaterThan(0);
    expect(estimateTokenBudgetForDuration(10)).toBeGreaterThan(0);
  });
});

describe('calculateImprovementPercentage', () => {
  it('returns the relative improvement between two scores', () => {
    expect(calculateImprovementPercentage(120, 100)).toBe('20');
    expect(calculateImprovementPercentage(100, 120)).toBe('20');
  });

  it('handles a zero baseline without dividing by zero', () => {
    expect(calculateImprovementPercentage(50, 0)).toBe('100');
  });
});

describe('resolveDefaultPrunaModel', () => {
  it('maps every generation type to a model id', () => {
    for (const type of ['text-to-image', 'image-to-image', 'text-to-video', 'image-to-video'] as const) {
      expect(resolveDefaultPrunaModel(type)).toBeTruthy();
    }
  });
});

describe('resolveCalendarEntryDate', () => {
  it('offsets day 1 to the base date and day N forward', () => {
    const base = Date.UTC(2026, 0, 1);
    expect(resolveCalendarEntryDate(1, base).getTime()).toBe(base);
    expect(resolveCalendarEntryDate(3, base).getTime()).toBe(base + 2 * 24 * 60 * 60 * 1000);
  });
});
