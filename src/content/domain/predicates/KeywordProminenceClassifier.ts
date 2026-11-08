
export type KeywordProminence = 'high' | 'medium' | 'low';

const HIGH_DENSITY_THRESHOLD = 2;
const MEDIUM_DENSITY_THRESHOLD = 1;

export function classifyKeywordProminence(densityPercent: number): KeywordProminence {
  if (densityPercent > HIGH_DENSITY_THRESHOLD) return 'high';
  if (densityPercent > MEDIUM_DENSITY_THRESHOLD) return 'medium';
  return 'low';
}

export function isUnderutilizedKeyword(densityPercent: number): boolean {
  return densityPercent < 1;
}
