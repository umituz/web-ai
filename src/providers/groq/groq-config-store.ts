import type { GroqProviderConfig } from "./groq.entities";
import { GroqError, GroqErrorType } from "../../core/errors/groq-error";
import { DEFAULT_BASE_URL, TIMEOUTS } from "./groq.constants";
import { validateApiKey } from "../../core/utils/api-key-validator";

export class GroqConfigStore {
  private config: GroqProviderConfig | null = null;

  initialize(config: GroqProviderConfig): GroqProviderConfig {
    const validation = validateApiKey(config.apiKey, { minLength: 1 });
    if (!validation.valid) {
      throw new GroqError(GroqErrorType.INVALID_API_KEY, validation.reason ?? "Invalid API key");
    }

    const normalized: GroqProviderConfig = {
      apiKey: config.apiKey.trim(),
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      timeoutMs: config.timeoutMs ?? TIMEOUTS.DEFAULT,
      ...(config.models !== undefined ? { models: config.models } : {}),
      ...(config.textModel !== undefined ? { textModel: config.textModel } : {}),
    };

    this.config = normalized;
    return normalized;
  }

  get(): GroqProviderConfig {
    if (!this.config) {
      throw new GroqError(
        GroqErrorType.MISSING_CONFIG,
        "Client not initialized. Call configureProvider first.",
      );
    }
    return this.config;
  }

  getOrNull(): GroqProviderConfig | null {
    return this.config;
  }

  isInitialized(): boolean {
    return this.config !== null;
  }

  setApiKey(apiKey: string): void {
    const current = this.get();
    const validation = validateApiKey(apiKey, { minLength: 1 });
    if (!validation.valid) {
      throw new GroqError(GroqErrorType.INVALID_API_KEY, validation.reason ?? "Invalid API key");
    }
    this.config = { ...current, apiKey: apiKey.trim() };
  }

  reset(): void {
    this.config = null;
  }
}
