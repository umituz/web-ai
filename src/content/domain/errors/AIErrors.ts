
import { AIError } from "../../../core/errors/ai-error";

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

export { AIError };

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
