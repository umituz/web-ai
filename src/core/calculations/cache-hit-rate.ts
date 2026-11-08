
export interface AccessCounted {
  readonly accessCount: number;
}

export function calculateCacheHitRate(
  entries: ReadonlyArray<AccessCounted>,
): number {
  if (entries.length === 0) return 0;
  const totalAccess = entries.reduce((sum, e) => sum + e.accessCount, 0);
  return totalAccess / entries.length;
}
