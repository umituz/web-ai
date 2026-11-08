
export type {
  PrunaModelId,
  PrunaAspectRatio,
  PrunaResolution,
  GenerationStage,
  PrunaJobStatus,
  GenerateOptions,
  TextToImageInput,
  ImageToImageInput,
  ImageToVideoInput,
  PrunaInput,
  TextToVideoInput,
  PrunaResult,
  PrunaPredictionResponse,
  PrunaUrlOutput,
  PrunaOutput,
  PrunaFileUploadResponse,
} from './entities/types';

export {
  PRUNA_BASE_URL,
  PRUNA_PREDICTIONS_URL,
  PRUNA_FILES_URL,
  HTTPS_PREFIX,
  HTTP_PREFIX,
  BASE64_MARKER,
  AUTH_FAILURE_STATUSES,
  MIN_API_KEY_LENGTH,
  MAX_API_KEY_LENGTH,
  DEFAULT_ASPECT_RATIO,
  P_VIDEO_DEFAULTS,
  POLL_DEFAULTS,
  DEFAULT_DEDUPLICATOR_TTL_MS,
  DEDUPLICATOR_CLEANUP_GRACE_MS,
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_CACHE_MAX_SIZE,
  PERFORMANCE_RETAINED_SAMPLES,
  MIME_PNG,
  MIME_JPEG,
  MIME_WEBP,
  DEFAULT_IMAGE_MIME,
  MIME_FILE_EXTENSION,
  IMAGE_SIGNATURES,
} from './constants';

export { CancellationError, isCancellationError, CANCELLATION_MESSAGE } from './errors/cancellation-error';
export { AuthenticationError, AUTHENTICATION_MESSAGE } from './errors/authentication-error';
export { TimeoutError, TIMEOUT_MESSAGE } from './errors/timeout-error';
export { ValidationError, isValidationError } from './errors/validation-error';
export type { ValidationErrorContext } from './errors/validation-error';
export { GenerationFailedError } from './services/pruna-client.service';

export {
  calculateExponentialBackoff,
  hashValue,
  compositeHash,
  deriveRequestDeduplicationKey,
  deriveGenerationCacheKey,
  createRollingAverage,
  createCacheStatsTracker,
  computeHitRate,
  utf8ByteLength,
  base64ByteLength,
  formatBytes,
  formatDuration,
  elapsedMilliseconds,
  totalBackoffDelayMs,
} from './math';
export type {
  BackoffInputs,
  RequestSignature,
  RollingAverage,
  RollingAverageOptions,
  CacheStats,
  CacheStatsTracker,
} from './math';

export {
  assertValidApiKey,
  assertValidProxyUrl,
  assertSecureImageSource,
  classifyImageSource,
  assertValidAspectRatio,
  isSupportedAspectRatio,
  SUPPORTED_ASPECT_RATIOS,
  assertValidResolution,
  isSupportedResolution,
  SUPPORTED_RESOLUTIONS,
  assertValidDuration,
  isValidDuration,
  MIN_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_DURATION_SECONDS,
  assertValidPrompt,
  isValidPrompt,
  MIN_PROMPT_LENGTH,
  MAX_PROMPT_LENGTH,
  assertValidSeed,
  isValidSeed,
  MIN_SEED,
  MAX_SEED,
} from './validation';
export type { ImageSourceKind } from './validation';

export {
  TERMINAL_SUCCESS_STATUSES,
  TERMINAL_FAILURE_STATUSES,
  IN_FLIGHT_STATUSES,
  isTerminalSuccessStatus,
  isTerminalFailureStatus,
  isInFlightStatus,
  isTerminalStatus,
  isAuthFailureStatus,
  isTransientServerError,
  isClientError,
  isTextToImageInput,
  isImageToImageInput,
  isImageToVideoInput,
  isImageGenerationModel,
  isVideoGenerationModel,
  isTextToVideoPipeline,
  SUPPORTED_MODEL_IDS,
  isSupportedModelId,
  modelRequiresImage,
  modelRequiresFileUpload,
  modelProducesAssetUrl,
  modelSupportsPolling,
  modelSupportsSeed,
  modelSupportsDuration,
  modelSupportsResolution,
  inputRequiresImage,
  isAbortError,
  isAbortSignal,
  isSignalAborted,
  isAbsoluteHttpUrl,
  isHttpsUrl,
  buildPrunaApiUrl,
  buildFileUrlById,
} from './protocol';

export {
  stripBase64Prefix,
  extractUri,
  resolveUri,
} from './utils/uri-resolver';
export { base64ToBytes } from './utils/base64';
export { detectImageMime } from './utils/mime-detector';
export { parseApiError } from './utils/api-error-parser';
export type { ApiErrorPayload, PrunaApiError } from './utils/api-error-parser';

export { shallowEqual } from './utils/compare';

export { LRUCache } from './utils/lru-cache';
export type { CacheOptions } from './utils/lru-cache';
export { RequestDeduplicator, globalDeduplicator, createDeduplicationKey } from './utils/request-deduplicator';

export { cleanupAbortController } from './utils/abort-cleanup';

export {
  PerformanceMonitor,
  getPerformanceMonitor,
  measurePerformance,
} from './utils/performance-monitor';
export type { PerformanceSnapshot, MemorySnapshot } from './utils/performance-monitor';
export { withPerformanceMonitoring } from './utils/performance-decorator';

export { uploadImage, submitPrediction, pollForResult } from './services/pruna-client.service';
