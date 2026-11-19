import { GroqError } from "../errors/groq-error";
import { AIErrorType } from "../errors/ai-error-types";

export interface ProviderErrorInput {
  readonly status?: number;
  readonly message?: string;
  readonly isTimeout?: boolean;
}

export interface ProviderErrorDecision {
  readonly action: 'retry' | 'fallback' | 'abort';
  readonly backoffDelayMs: number;
  readonly fallbackModelId?: string;
  readonly reason: string;
}

export function handleProviderError(
  error: ProviderErrorInput,
  attemptNumber: number,
  fallbackModelId?: string,
): ProviderErrorDecision {
  const attempt = Math.max(1, attemptNumber);

  if (error.status === 429) {
    if (attempt <= 3) {
      const backoffDelayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      return {
        action: 'retry',
        backoffDelayMs,
        reason: 'Rate limit encountered; backing off exponentially',
      };
    }
    return {
      action: 'fallback',
      backoffDelayMs: 0,
      fallbackModelId: fallbackModelId ?? 'offline-fallback',
      reason: 'Rate limit exceeded max retries; switching to offline fallback',
    };
  }

  if (error.isTimeout || error.status === 504) {
    if (attempt <= 2) {
      return {
        action: 'retry',
        backoffDelayMs: 1500,
        reason: 'Gateway timeout; retrying once with warm connection',
      };
    }
    return {
      action: 'fallback',
      backoffDelayMs: 0,
      fallbackModelId: fallbackModelId ?? 'llama-3.3-70b',
      reason: 'Timeout threshold breached; falling back to faster lightweight model',
    };
  }

  if (error.status === 500 || error.status === 502 || error.status === 503) {
    if (attempt <= 2) {
      return {
        action: 'retry',
        backoffDelayMs: 1000 * attempt,
        reason: 'Provider temporary outage; retrying',
      };
    }
    return {
      action: 'fallback',
      backoffDelayMs: 0,
      fallbackModelId: fallbackModelId ?? 'llama-3.3-70b',
      reason: 'Provider unreachable; falling back to secondary tier',
    };
  }

  return {
    action: 'abort',
    backoffDelayMs: 0,
    reason: error.message || 'Fatal unrecoverable client error',
  };
}

export interface ClassifiedProviderError {
  readonly code: 'ai.rateLimit' | 'ai.error';
  readonly status: 429 | 502 | 504;
  readonly isTimeout: boolean;
  readonly isRateLimit: boolean;
}

export function classifyGroqError(err: unknown): ClassifiedProviderError {
  if (err instanceof GroqError) {
    const isTimeout = err.type === AIErrorType.ABORT_ERROR;
    const isRateLimit = err.type === AIErrorType.RATE_LIMIT_ERROR;
    const status: 429 | 502 | 504 = isRateLimit ? 429 : isTimeout ? 504 : 502;
    const code: 'ai.rateLimit' | 'ai.error' = isRateLimit ? 'ai.rateLimit' : 'ai.error';
    return { code, status, isTimeout, isRateLimit };
  }
  return { code: 'ai.error', status: 502, isTimeout: false, isRateLimit: false };
}
