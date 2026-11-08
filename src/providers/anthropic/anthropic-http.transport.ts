
import type {
  AnthropicErrorResponse,
  AnthropicMessagesRequest,
  AnthropicMessagesResponse,
  AnthropicProviderConfig,
} from "./anthropic.entities";
import { AIError, type AIErrorMetadata, AIErrorType } from "../../core/errors";
import { classifyHttpStatus, extractErrorMessageFromResponse } from "../../core/errors";
import {
  ANTHROPIC_BASE_URL,
  ANTHROPIC_HEADERS,
  ANTHROPIC_MESSAGES_PATH,
  ANTHROPIC_MODELS_PATH,
  ANTHROPIC_API_VERSION,
  ANTHROPIC_TIMEOUTS,
} from "./anthropic.constants";

export interface StreamRequestOptions {
  readonly signal?: AbortSignal;
}

/**
 * Raw HTTP transport for the Anthropic Messages API (anthropic-version
 * 2026-10-21). Auth is `x-api-key` — NOT a Bearer header. All failures leave
 * here as core AIError with the neutral taxonomy (401→INVALID_API_KEY,
 * 429→RATE_LIMIT, ≥500→SERVER, network TypeError→NETWORK, abort→ABORT).
 */
export class AnthropicHttpTransport {
  constructor(private readonly config: AnthropicProviderConfig) {}

  async postMessages(
    request: AnthropicMessagesRequest,
    options: StreamRequestOptions = {},
  ): Promise<AnthropicMessagesResponse> {
    const url = `${this.baseUrl()}${ANTHROPIC_MESSAGES_PATH}`;
    const timeout = this.config.timeoutMs ?? ANTHROPIC_TIMEOUTS.DEFAULT;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const onExternalAbort = (): void => controller.abort();
    options.signal?.addEventListener("abort", onExternalAbort);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify({ ...request, stream: false }),
        signal: controller.signal,
      });

      if (!response.ok) await this.throwFromErrorResponse(response);

      return (await response.json()) as AnthropicMessagesResponse;
    } catch (error) {
      throw this.normalizeError(error);
    } finally {
      clearTimeout(timeoutId);
      options.signal?.removeEventListener("abort", onExternalAbort);
    }
  }

  async streamMessages(
    request: AnthropicMessagesRequest,
    options: StreamRequestOptions = {},
  ): Promise<ReadableStream<Uint8Array>> {
    const url = `${this.baseUrl()}${ANTHROPIC_MESSAGES_PATH}`;
    const timeout = this.config.timeoutMs ?? ANTHROPIC_TIMEOUTS.STREAMING;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const onExternalAbort = (): void => controller.abort();
    options.signal?.addEventListener("abort", onExternalAbort);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify({ ...request, stream: true }),
        signal: controller.signal,
      });

      if (!response.ok) await this.throwFromErrorResponse(response);

      if (!response.body) {
        throw new AIError(AIErrorType.NETWORK_ERROR, "Response body is null");
      }

      return response.body;
    } catch (error) {
      options.signal?.removeEventListener("abort", onExternalAbort);
      throw this.normalizeError(error);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async listModels(): Promise<Response> {
    const url = `${this.baseUrl()}${ANTHROPIC_MODELS_PATH}`;
    return fetch(url, {
      method: "GET",
      headers: this.buildHeaders(),
    });
  }

  private baseUrl(): string {
    return this.config.baseUrl ?? ANTHROPIC_BASE_URL;
  }

  private buildHeaders(): HeadersInit {
    return {
      [ANTHROPIC_HEADERS.CONTENT_TYPE]: ANTHROPIC_HEADERS.APPLICATION_JSON,
      [ANTHROPIC_HEADERS.API_KEY]: this.config.apiKey,
      [ANTHROPIC_HEADERS.VERSION]: ANTHROPIC_API_VERSION,
    };
  }

  private async throwFromErrorResponse(response: Response): Promise<never> {
    const errorMessage = await extractErrorMessageFromResponse(response);
    const metadata: AIErrorMetadata = {
      status: response.status,
      url: response.url,
    };
    throw new AIError(
      classifyHttpStatus(response.status),
      errorMessage,
      undefined,
      metadata,
    );
  }

  private normalizeError(error: unknown): AIError {
    if (error instanceof AIError) return error;

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return new AIError(
          AIErrorType.ABORT_ERROR,
          "Request was aborted by the client",
          error,
        );
      }
      if (error.name === "TypeError" && error.message.toLowerCase().includes("network")) {
        return new AIError(
          AIErrorType.NETWORK_ERROR,
          "Network error: Unable to connect to the AI service",
          error,
        );
      }
    }

    return new AIError(
      AIErrorType.UNKNOWN_ERROR,
      error instanceof Error ? error.message : "Unknown error occurred",
      error instanceof Error ? error : undefined,
    );
  }
}

/** Shape guard for tests and error extraction. */
export type { AnthropicErrorResponse };
