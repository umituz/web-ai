
interface PendingRequest<T> {
  readonly promise: Promise<T>;
  readonly timestamp: number;
}

const DEFAULT_DEDUPE_TTL_MS = 30_000;

export class RequestDeduplicator {
  private readonly pendingRequests = new Map<string, PendingRequest<unknown>>();
  private readonly ttl: number;

  constructor(ttl: number = DEFAULT_DEDUPE_TTL_MS) {
    this.ttl = ttl;
  }

  execute<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    this.cleanup();

    const existing = this.pendingRequests.get(key);
    if (existing) {
      return existing.promise as Promise<T>;
    }

    const promise = requestFn();
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
    });

    // The cleanup chain must swallow its own rejection: callers handle the
    // original `promise`, and an unhandled `.finally` derivative would crash
    // hosts that treat unhandled rejections as fatal (Workers, vitest).
    promise
      .catch(() => undefined)
      .then(() => {
        this.pendingRequests.delete(key);
      });

    return promise;
  }

  cancelAll(): void {
    this.pendingRequests.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.ttl) {
        this.pendingRequests.delete(key);
      }
    }
  }
}

export const requestDeduplicator = new RequestDeduplicator();
