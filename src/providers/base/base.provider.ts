
import type { ProviderHealth } from "../../core/types";
import { AIError } from "../../content/domain/errors/AIErrors";
import { ProviderTimingConfig } from "../../content/domain/limits/ProviderTimingConfig";
import { calculateRetryBackoffDelayMs } from "../../content/domain/calculations/RetryBackoffDelay";
import type { CostEstimateRequest } from "./provider.types";

export interface BaseProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
}

/**
 * Convenience base for providers that talk raw fetch (gemini/fal/pruna style):
 * timeout-bounded fetch plus a simple retry loop. The Groq and Anthropic
 * providers bring their own transport machinery and do not extend this.
 */
export abstract class BaseProvider {
  protected config: BaseProviderConfig;

  constructor(config: BaseProviderConfig) {
    this.config = config;
  }

  async healthCheck(): Promise<ProviderHealth> {
    if (!this.config.apiKey) {
      return "unavailable";
    }
    return "healthy";
  }

  async estimateCost(_request: CostEstimateRequest): Promise<number> {
    return 0;
  }

  protected async fetchWithTimeout(url: string, options: RequestInit, timeout?: number): Promise<Response> {
    const effectiveTimeout = timeout ?? this.config.timeout ?? ProviderTimingConfig.DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  protected async withRetry<T>(fn: () => Promise<T>, maxAttempts?: number): Promise<T> {
    const attempts = maxAttempts ?? this.config.retryAttempts ?? ProviderTimingConfig.DEFAULT_RETRY_ATTEMPTS;
    let lastError: Error | undefined;

    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, calculateRetryBackoffDelayMs(i)));
        }
      }
    }

    throw lastError || new Error("Retry attempts exhausted");
  }
}

export class ProviderError extends AIError {
  constructor(
    message: string,
    public readonly providerId: string,
    originalError?: unknown
  ) {
    super(message, "PROVIDER_ERROR", originalError);
    this.name = "ProviderError";
  }
}
