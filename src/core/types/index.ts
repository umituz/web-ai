/**
 * Provider-neutral types shared by every layer of @umituz/web-ai.
 * Nothing in this file imports a provider — the whole point of the package
 * is that swapping Groq for Claude (or vice versa) is a config change, and
 * these types are the vocabulary that makes that possible.
 */

/** Neutral quality tier — providers map it onto their own concrete models. */
export type TextTier = "fast" | "balanced" | "powerful";

/** Why the model stopped generating, normalized across providers. */
export type FinishReason = "stop" | "length" | "content_filter" | "refusal";

/** Token accounting, normalized from each provider's native usage shape. */
export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens?: number;
}

/** What every text-generating method returns — usage is never discarded. */
export interface GenerationResult {
  readonly text: string;
  readonly usage?: TokenUsage;
  readonly model: string;
  readonly providerId: string;
  readonly finishReason?: FinishReason;
}

/** Universal chat message shape; providers translate to their own wire format. */
export interface ChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface TextRequest {
  /** Full conversation, oldest first. systemPrompt is preferred over system roles here. */
  readonly messages: ReadonlyArray<ChatMessage>;
  /** Top-level system instruction; providers that need it in-band map it themselves. */
  readonly systemPrompt?: string;
  /** Explicit model id — always wins over tier resolution. */
  readonly model?: string;
  /** Neutral quality tier; resolved against the serving provider's model map. */
  readonly tier?: TextTier;
  readonly maxTokens?: number;
  /**
   * Sampling hints. Honored by providers whose API still supports sampling
   * parameters (Groq, Gemini); ignored by Anthropic — its current API version
   * rejects temperature/top_p outright, so the Anthropic provider never puts
   * them on the wire.
   */
  readonly temperature?: number;
  readonly topP?: number;
  readonly stopSequences?: ReadonlyArray<string>;
  readonly signal?: AbortSignal;
}

export interface StreamCallbacks {
  readonly onChunk?: (text: string) => void;
  readonly onComplete?: (result: GenerationResult) => void;
  readonly onError?: (error: Error) => void;
}

export interface StructuredTextRequest extends TextRequest {
  /** JSON schema describing the expected object; embedded into the prompt. */
  readonly schema: Record<string, unknown>;
}

export interface StructuredGeneration<T> {
  readonly value: T;
  readonly result: GenerationResult;
}

export type ProviderHealth = "healthy" | "degraded" | "exhausted" | "unavailable";
