
const FAL_FORMAT_TO_IMAGE_SIZE: Readonly<Record<string, string>> = {
  square: 'square_hd',
  landscape: 'landscape_16_9',
  portrait: 'portrait_9_16',
  story: 'portrait_9_16',
  banner: 'landscape_16_9',
};

const FAL_DEFAULT_IMAGE_SIZE = 'square_hd';

const FAL_QUALITY_TO_STEPS: Readonly<Record<string, number>> = {
  standard: 4,
  high: 6,
  ultra: 8,
};

const FAL_DEFAULT_QUALITY_STEPS = 6;

export function resolveFalImageSize(format?: string): string {
  if (!format) return FAL_DEFAULT_IMAGE_SIZE;
  return FAL_FORMAT_TO_IMAGE_SIZE[format] ?? FAL_DEFAULT_IMAGE_SIZE;
}

export function resolveFalInferenceSteps(quality?: string): number {
  if (!quality) return FAL_DEFAULT_QUALITY_STEPS;
  return FAL_QUALITY_TO_STEPS[quality] ?? FAL_DEFAULT_QUALITY_STEPS;
}
