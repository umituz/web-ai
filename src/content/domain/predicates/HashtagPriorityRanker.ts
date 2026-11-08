
import type { SocialPlatform } from '../types';
import { PLATFORM_SPECS } from '../types';

export const DEFAULT_HASHTAG_BUDGET: number = Number.MAX_SAFE_INTEGER;

export function resolveHashtagBudget(platform: SocialPlatform): number {
  return PLATFORM_SPECS[platform]?.maxHashtags ?? DEFAULT_HASHTAG_BUDGET;
}

export function rankAndTrimHashtags(hashtags: ReadonlyArray<string>, budget: number): string[] {
  if (hashtags.length <= budget) return [...hashtags];
  return [...hashtags].sort((a, b) => b.length - a.length).slice(0, budget);
}
