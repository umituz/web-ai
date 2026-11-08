
import { ASPECT_RATIO_OPTIONS, type AspectRatio } from '../limits/ImageFormatOptions';

const FALLBACK_DIMENSIONS = { width: 1024, height: 1024 } as const;

export function resolveDimensionsForAspectRatio(
  ratio: AspectRatio,
): { width: number; height: number } {
  const match = ASPECT_RATIO_OPTIONS.find((option) => option.value === ratio);
  return match ? { width: match.width, height: match.height } : FALLBACK_DIMENSIONS;
}
