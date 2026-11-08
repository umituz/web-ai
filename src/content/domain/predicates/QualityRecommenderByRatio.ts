
import type { AspectRatio, ImageQuality, VideoQuality } from '../limits/ImageFormatOptions';

const WIDE_RATIOS: ReadonlySet<AspectRatio> = new Set(['16:9', '4:3']);

export function recommendQualityForAspectRatio(
  ratio: AspectRatio,
): ImageQuality | VideoQuality {
  return WIDE_RATIOS.has(ratio) ? 'hd' : 'standard';
}
