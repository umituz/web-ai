
import type { GroqChatRequest, GroqChatResponse, StreamRequestOptions } from "./groq.entities";
import { AIError, type AIErrorMetadata } from "../../core/errors";
import { AIErrorType } from "../../core/errors";
import { classifyHttpStatus, extractErrorMessageFromResponse } from "../../core/errors";
import {
  CHAT_COMPLETIONS_PATH,
  GROQ_BASE_URL,
  GROQ_TIMEOUTS,
  HTTP_HEADERS,
} from "./groq.constants";
import type { GroqProviderConfig } from "./groq.entities";

/**
 * Raw HTTP transport for Groq's OpenAI-compatible chat/completions endpoint.
 * All failures leave here as core AIError with the right AIErrorType —
 * callers up the stack only ever see the neutral taxonomy.
 */
export class GroqHttpTransport {
  private readonly pendingAbortControllers = new Set<AbortController>();

  constructor(private readonly config: GroqProviderConfig) {}

  cancelPendingRequests(): void {
    for (const controller of this.pendingAbortControllers) {
      controller.abort();
    }
    this.pendingAbortControllers.clear();
  }

  async postChatCompletion(request: GroqChatRequest): Promise<GroqChatResponse> {
    return this.request<GroqChatResponse>(CHAT_COMPLETIONS_PATH, {
      ...request,
      stream: false,
    });
  }

  async streamChatCompletion(
    request: GroqChatRequest,
    options: StreamRequestOptions = {},
  ): Promise<ReadableStream<Uint8Array>> {
    const url = `${this.baseUrl()}${CHAT_COMPLETIONS_PATH}`;
    const timeout = this.config.timeoutMs ?? GROQ_TIMEOUTS.STREAMING;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const onExternalAbort = (): void => controller.abort();
    options.signal?.addEventListener("abort", onExternalAbort);
    this.pendingAbortControllers.add(controller);

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
      this.pendingAbortControllers.delete(controller);
    }
  }

  private baseUrl(): string {
    return this.config.baseUrl ?? GROQ_BASE_URL;
  }

  private async request<T>(endpoint: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl()}${endpoint}`;
    const timeout = this.config.timeoutMs ?? GROQ_TIMEOUTS.DEFAULT;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    this.pendingAbortControllers.add(controller);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) await this.throwFromErrorResponse(response);

      return (await response.json()) as T;
    } catch (error) {
      throw this.normalizeError(error);
    } finally {
      clearTimeout(timeoutId);
      this.pendingAbortControllers.delete(controller);
    }
  }

  private buildHeaders(): HeadersInit {
    return {
      [HTTP_HEADERS.CONTENT_TYPE]: HTTP_HEADERS.APPLICATION_JSON,
      [HTTP_HEADERS.AUTHORIZATION]: `${HTTP_HEADERS.BEARER_PREFIX}${this.config.apiKey}`,
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
