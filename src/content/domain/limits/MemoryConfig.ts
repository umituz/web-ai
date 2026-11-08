
export const MemoryConfig = {
  MANAGER: {
    MAX_SIZE_BYTES: 50 * 1024 * 1024,
    CLEANUP_THRESHOLD_RATIO: 0.8,
    RETENTION_RATIO: 0.5,
  },
  POOL: {
    DEFAULT_MAX_SIZE: 100,
  },
  EXPIRING_CACHE: {
    DEFAULT_TTL_MS: 60_000,
    CLEANUP_INTERVAL_MS: 60_000,
  },
} as const;
