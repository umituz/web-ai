
import { DEFAULT_DEDUPLICATOR_TTL_MS, DEDUPLICATOR_CLEANUP_GRACE_MS } from '../constants/limits';
import { deriveRequestDeduplicationKey } from '../math/cache-key-derivation';
import type { RequestSignature } from '../math/cache-key-derivation';

interface PendingRequest {
  promise: Promise<unknown>;
  timestamp: number;
}

export class RequestDeduplicator {
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private readonly ttl: number;

  constructor(ttl: number = DEFAULT_DEDUPLICATOR_TTL_MS) {
    this.ttl = ttl;
  }

  execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.pendingRequests.get(key);
    if (existing) {
      if (Date.now() - existing.timestamp < this.ttl) {
        return existing.promise as Promise<T>;
      }
      this.pendingRequests.delete(key);
    }

    const promise = fn().finally(() => {
      setTimeout(() => {
        this.pendingRequests.delete(key);
      }, DEDUPLICATOR_CLEANUP_GRACE_MS);
    });

    this.pendingRequests.set(key, { promise, timestamp: Date.now() });
    return promise;
  }

  clear(): void {
    this.pendingRequests.clear();
  }

  size(): number {
    this.purgeExpired();
    return this.pendingRequests.size;
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [key, value] of this.pendingRequests) {
      if (now - value.timestamp >= this.ttl) {
        this.pendingRequests.delete(key);
      }
    }
  }
}

export const globalDeduplicator = new RequestDeduplicator();

export function createDeduplicationKey(
  method: string,
  url: string,
  body?: Record<string, unknown>,
): string {
  const signature: RequestSignature = { method, url, body };
  return deriveRequestDeduplicationKey(signature);
}
