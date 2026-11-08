
const SCORE_MIN = 0;
const SCORE_MAX = 100;
const SCORE_FALLBACK = 50;

const CONFIDENCE_MIN = 0;
const CONFIDENCE_MAX = 1;
const CONFIDENCE_FALLBACK = 0.5;

export function clampScoreToValidRange(score: number, fallback: number = SCORE_FALLBACK): number {
  if (!Number.isFinite(score)) return fallback;
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, score));
}

export function clampConfidenceToValidRange(
  confidence: number,
  fallback: number = CONFIDENCE_FALLBACK,
): number {
  if (!Number.isFinite(confidence)) return fallback;
  return Math.max(CONFIDENCE_MIN, Math.min(CONFIDENCE_MAX, confidence));
}
