
import {
  ASPECT_RATIO_OPTIONS,
  IMAGE_QUALITY_OPTIONS,
  VIDEO_QUALITY_OPTIONS,
  VIDEO_DURATION_OPTIONS_SECONDS,
  MOTION_OPTIONS,
  STYLE_PRESETS,
} from '../limits/ImageFormatOptions';
import {
  resolveDimensionsForAspectRatio,
} from '../calculations/AspectRatioDimensions';
import { recommendQualityForAspectRatio } from '../predicates/QualityRecommenderByRatio';

export const ASPECT_RATIO_VALUES = ASPECT_RATIO_OPTIONS.map((o) => o.value);
export const IMAGE_QUALITY_VALUES = IMAGE_QUALITY_OPTIONS.map((o) => o.value);
export const VIDEO_QUALITY_VALUES = VIDEO_QUALITY_OPTIONS.map((o) => o.value);

export const VIDEO_DURATION_OPTIONS = VIDEO_DURATION_OPTIONS_SECONDS;

export { MOTION_OPTIONS, STYLE_PRESETS };

export const getDimensionsForAspectRatio = resolveDimensionsForAspectRatio;

export const getRecommendedQuality = recommendQualityForAspectRatio;
