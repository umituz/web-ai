export { CacheManager, cacheManager } from "./cache-manager";
export type { CacheOptions, CacheStats } from "./cache-manager";
export { RetryManager, retryManager, withRetry } from "./retry";
export type { RetryOptions } from "./retry";
export { RequestQueue, requestQueue } from "./request-queue.util";
export type { QueueOptions } from "./request-queue.util";
export { RequestDeduplicator, requestDeduplicator } from "./request-deduplicator.util";
export { DebounceManager, ThrottleManager, debounceManager, throttleManager, debounce, throttle } from "./debounce";
export type { DebounceOptions, ThrottleOptions } from "./debounce";
export { buildCacheKey } from "./cache-key-builder";
export { isValidApiKey, validateApiKey, DEFAULT_API_KEY_RULE } from "./api-key-validator";
export type { ApiKeyValidationRule } from "./api-key-validator";
export {
  asRecord,
  asStringArray,
  asObjectArray,
  asTrimmedOptionalString,
  clampScore,
  oneOfCatalog,
} from "./coercion.util";
export {
  canFailover,
  failoverCandidate,
  isTransientError,
  TRANSIENT_ERROR_CODES,
} from "./failover";
export type { FailoverErrorLike, ModelWithProvider } from "./failover";
