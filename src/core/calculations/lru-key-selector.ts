
export interface AccessTimestamped {
  readonly lastAccess: number;
}

export function selectLeastRecentlyUsedKey<K, V extends AccessTimestamped>(
  entries: ReadonlyMap<K, V>,
): K | null {
  let oldestKey: K | null = null;
  let oldestAccess = Number.POSITIVE_INFINITY;

  for (const [key, entry] of entries.entries()) {
    if (entry.lastAccess < oldestAccess) {
      oldestAccess = entry.lastAccess;
      oldestKey = key;
    }
  }

  return oldestKey;
}
