
import type { PlatformSpecs, SocialPlatform } from '../types';
import { PLATFORM_SPECS } from '../types';

const FALLBACK_SPEC: PlatformSpecs = {
  maxLength: 280,
  style: 'concise, engaging, audience-friendly',
  emojiSupport: true,
  hashtagSupport: true,
  imageSupport: true,
  videoSupport: true,
  maxHashtags: 5,
};

export function resolvePlatformSpec(platform: SocialPlatform): PlatformSpecs {
  return PLATFORM_SPECS[platform] ?? FALLBACK_SPEC;
}

export function resolveMaxContentLength(platform: SocialPlatform, override?: number): number {
  return override ?? resolvePlatformSpec(platform).maxLength;
}
