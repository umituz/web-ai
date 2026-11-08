
import type { PrunaAspectRatio, PrunaResolution } from '../entities/types';

export const DEFAULT_ASPECT_RATIO: PrunaAspectRatio = '16:9';

export const P_VIDEO_DEFAULTS = {
  duration: 5,
  resolution: '720p' as PrunaResolution,
  fps: 24,
  draft: false,
  promptUpsampling: true,
} as const;

export const POLL_DEFAULTS = {
  intervalMs: 3_000,
  maxAttempts: 120,
  maxIntervalMs: 10_000,
  backoffBase: 1.5,
  jitterPercent: 0.1,
} as const;

export const DEFAULT_DEDUPLICATOR_TTL_MS = 30_000;

export const DEDUPLICATOR_CLEANUP_GRACE_MS = 100;

export const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

export const DEFAULT_CACHE_MAX_SIZE = 50;

export const PERFORMANCE_RETAINED_SAMPLES = 100;
