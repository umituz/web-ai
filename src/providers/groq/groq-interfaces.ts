import type {
  GroqMessage,
  GroqChatResponse,
  GroqChatRequest,
  GroqGenerationConfig,
  StreamRequestOptions,
  GroqProviderConfig,
} from "./groq.entities";

export interface TextGenerationOptions {
  readonly model?: string;
  readonly generationConfig?: GroqGenerationConfig;
  readonly signal?: AbortSignal;
}

export interface StreamingCallbacks {
  readonly onChunk?: (chunk: string) => void;
  readonly onComplete?: (fullText: string) => void;
  readonly onError?: (error: Error) => void;
}

export interface StructuredGenerationOptions {
  readonly model?: string;
  readonly generationConfig?: GroqGenerationConfig;
  readonly schema?: Record<string, unknown>;
}

export interface IGroqChatService {
  generateCompletion(
    prompt: string,
    options?: TextGenerationOptions,
  ): Promise<string>;

  generateChatCompletion(
    messages: ReadonlyArray<GroqMessage>,
    options?: TextGenerationOptions,
  ): Promise<string>;

  generateStructured<T>(
    prompt: string,
    options?: StructuredGenerationOptions,
  ): Promise<T>;

  streamCompletion(
    prompt: string,
    callbacks: StreamingCallbacks,
    options?: TextGenerationOptions,
  ): Promise<string>;

  streamChatCompletion(
    messages: ReadonlyArray<GroqMessage>,
    callbacks: StreamingCallbacks,
    options?: TextGenerationOptions,
  ): Promise<string>;

  clearCache(): void;
}

export interface IGroqHttpClient {
  postChatCompletion(request: GroqChatRequest): Promise<GroqChatResponse>;
  streamChatCompletion(
    request: GroqChatRequest,
    options?: StreamRequestOptions,
  ): Promise<ReadableStream<Uint8Array>>;
  getApiKey(): string;
  setApiKey(apiKey: string): void;
  initialize(config: GroqProviderConfig): void;
  isInitialized(): boolean;
  cancelPendingRequests(): void;
  reset(): void;
}
