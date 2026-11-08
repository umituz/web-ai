
import { AIError } from "../errors/ai-error";
import { calculateExponentialBackoff } from "../calculations/exponential-backoff";
import {
  isRetryableErrorType,
  DEFAULT_ERROR_CLASSIFICATION_RULE,
} from "../errors/error-classifier";
import {
  DEFAULT_RETRY_MAX_ATTEMPTS,
  DEFAULT_RETRY_INITIAL_DELAY_MS,
  DEFAULT_RETRY_MAX_DELAY_MS,
  DEFAULT_RETRY_BACKOFF_MULTIPLIER,
  DEFAULT_RETRY_JITTER_FACTOR,
} from "../constants/identifier.constants";

export interface RetryOptions {
  readonly maxAttempts?: number;
  readonly initialDelay?: number;
  readonly maxDelay?: number;
  readonly backoffMultiplier?: number;
  readonly jitterFactor?: number;
  readonly shouldRetry?: (error: Error) => boolean;
}

const RETRYABLE_MESSAGE_KEYWORDS: ReadonlyArray<string> = [
  "network",
  "timeout",
  "econnrefused",
  "enotfound",
  "etimedout",
];

export class RetryManager {
  private readonly defaults: Required<
    Pick<RetryOptions, "maxAttempts" | "initialDelay" | "maxDelay" | "backoffMultiplier" | "jitterFactor">
  >;

  constructor() {
    this.defaults = {
      maxAttempts: DEFAULT_RETRY_MAX_ATTEMPTS,
      initialDelay: DEFAULT_RETRY_INITIAL_DELAY_MS,
      maxDelay: DEFAULT_RETRY_MAX_DELAY_MS,
      backoffMultiplier: DEFAULT_RETRY_BACKOFF_MULTIPLIER,
      jitterFactor: DEFAULT_RETRY_JITTER_FACTOR,
    };
  }

  async execute<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const maxAttempts = options.maxAttempts ?? this.defaults.maxAttempts;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt >= maxAttempts || !this.shouldRetry(lastError, options)) {
          throw lastError;
        }

        const delay = calculateExponentialBackoff({
          attempt,
          initialDelay: options.initialDelay ?? this.defaults.initialDelay,
          maxDelay: options.maxDelay ?? this.defaults.maxDelay,
          backoffMultiplier: options.backoffMultiplier ?? this.defaults.backoffMultiplier,
          jitterFactor: options.jitterFactor ?? this.defaults.jitterFactor,
        });
        await this.delay(delay);
      }
    }

    throw lastError ?? new Error("Retry loop exited without result");
  }

  private shouldRetry(error: Error, options: RetryOptions): boolean {
    if (options.shouldRetry) return options.shouldRetry(error);

    if (error instanceof AIError) {
      return isRetryableErrorType(error.type, DEFAULT_ERROR_CLASSIFICATION_RULE);
    }

    const lower = error.message.toLowerCase();
    return RETRYABLE_MESSAGE_KEYWORDS.some((kw) => lower.includes(kw));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const retryManager = new RetryManager();

export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  return retryManager.execute(fn, options);
}
