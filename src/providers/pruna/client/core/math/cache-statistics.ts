
export interface CacheStats {
  hits: number;
  misses: number;
  totalLookups: number;
  hitRate: number;
}

export interface CacheStatsTracker {
  recordHit: () => void;
  recordMiss: () => void;
  snapshot: () => CacheStats;
  reset: () => void;
}

export function createCacheStatsTracker(): CacheStatsTracker {
  let hits = 0;
  let misses = 0;

  const recordHit = (): void => { hits += 1; };
  const recordMiss = (): void => { misses += 1; };

  const snapshot = (): CacheStats => {
    const totalLookups = hits + misses;
    return {
      hits,
      misses,
      totalLookups,
      hitRate: totalLookups === 0 ? 0 : hits / totalLookups,
    };
  };

  const reset = (): void => {
    hits = 0;
    misses = 0;
  };

  return { recordHit, recordMiss, snapshot, reset };
}

export function computeHitRate(hits: number, misses: number): number {
  const total = hits + misses;
  return total === 0 ? 0 : hits / total;
}
