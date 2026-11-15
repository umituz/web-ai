export interface AllowanceWindowOptions {
  readonly limit: number;
  readonly windowMs?: number;
}

export interface AllowanceWindow {
  allow(key: string, now?: number): boolean;
}

interface AllowanceBucket {
  windowStart: number;
  count: number;
}

export const DEFAULT_ALLOWANCE_WINDOW_MS = 3_600_000;

export function createAllowanceWindow(options: AllowanceWindowOptions): AllowanceWindow {
  const windowMs = options.windowMs ?? DEFAULT_ALLOWANCE_WINDOW_MS;
  const buckets = new Map<string, AllowanceBucket>();
  return {
    allow(key: string, now: number = Date.now()): boolean {
      const bucket = buckets.get(key);
      if (bucket === undefined || now - bucket.windowStart >= windowMs) {
        buckets.set(key, { windowStart: now, count: 1 });
        return true;
      }
      bucket.count += 1;
      return bucket.count <= options.limit;
    },
  };
}
