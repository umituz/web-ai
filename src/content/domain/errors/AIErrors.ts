
export type AIErrorCode =
  | 'VALIDATION_ERROR'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_QUOTA_EXHAUSTED'
  | 'PROVIDER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'PARSE_ERROR'
  | 'NO_RESULT'
  | 'UNKNOWN';

export class AIError extends Error {
  public readonly code: AIErrorCode;
  public readonly cause?: unknown;

  constructor(message: string, code: AIErrorCode, cause?: unknown) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.cause = cause;
  }

  static from(error: unknown, fallbackCode: AIErrorCode = 'UNKNOWN'): AIError {
    if (error instanceof AIError) return error;
    if (error instanceof Error) {
      return new AIError(error.message, mapMessageToCode(error.message, fallbackCode), error);
    }
    return new AIError(String(error), fallbackCode, error);
  }
}

function mapMessageToCode(message: string, fallback: AIErrorCode): AIErrorCode {
  const lower = message.toLowerCase();
  if (lower.includes('validation')) return 'VALIDATION_ERROR';
  if (lower.includes('quota')) return 'PROVIDER_QUOTA_EXHAUSTED';
  if (lower.includes('unavailable')) return 'PROVIDER_UNAVAILABLE';
  if (lower.includes('timeout') || lower.includes('aborted')) {
    return lower.includes('aborted') ? 'ABORTED' : 'TIMEOUT';
  }
  if (lower.includes('parse') || lower.includes('json')) return 'PARSE_ERROR';
  if (lower.includes('no result')) return 'NO_RESULT';
  if (lower.includes('network') || lower.includes('fetch')) return 'NETWORK_ERROR';
  return fallback;
}

export class ValidationError extends AIError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class ProviderUnavailableError extends AIError {
  constructor(providerId: string) {
    super(`Provider ${providerId} is not available`, 'PROVIDER_UNAVAILABLE');
    this.name = 'ProviderUnavailableError';
  }
}

export class ProviderQuotaExhaustedError extends AIError {
  constructor(providerId: string) {
    super(`Provider ${providerId} quota exhausted`, 'PROVIDER_QUOTA_EXHAUSTED');
    this.name = 'ProviderQuotaExhaustedError';
  }
}
