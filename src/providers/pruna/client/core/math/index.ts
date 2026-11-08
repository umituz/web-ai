
export { calculateExponentialBackoff } from './exponential-backoff';
export type { BackoffInputs } from './exponential-backoff';

export { hashValue, compositeHash } from './comparison-hash';

export { deriveRequestDeduplicationKey, deriveGenerationCacheKey } from './cache-key-derivation';
export type { RequestSignature } from './cache-key-derivation';

export { createRollingAverage } from './rolling-average';
export type { RollingAverage, RollingAverageOptions } from './rolling-average';

export { createCacheStatsTracker, computeHitRate } from './cache-statistics';
export type { CacheStats, CacheStatsTracker } from './cache-statistics';

export { utf8ByteLength, base64ByteLength, formatBytes } from './byte-size';

export {
  formatDuration,
  elapsedMilliseconds,
  totalBackoffDelayMs,
} from './duration-format';
