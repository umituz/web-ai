
import type { TierModelMap } from "../../core/tiers";

/**
 * Groq wire types. The `Groq` prefix is deliberate: these describe Groq's
 * OpenAI-compatible chat/completions wire format and nothing else. Providers
 * translate core `TextRequest`s into these; the rest of the package never
 * sees them.
 */

export interface GroqProviderConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  /** Per-tier model overrides; merged over GROQ_TIERS. */
  readonly models?: TierModelMap;
  /** Legacy model selector from @umituz/web-ai-groq-provider. */
  readonly textModel?: string;
}

export type GroqConfig = GroqProviderConfig;

export type GroqReasoningEffort = "low" | "medium" | "high";

export interface GroqGenerationConfig {
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly topP?: number;
  readonly n?: number;
  readonly stop?: string[];
  readonly frequencyPenalty?: number;
  readonly presencePenalty?: number;
  readonly reasoningEffort?: GroqReasoningEffort;
}

export type GroqMessageRole = "system" | "user" | "assistant";

export interface GroqMessage {
  readonly role: GroqMessageRole;
  readonly content: string;
}

export interface GroqChatRequest {
  readonly model: string;
  readonly messages: GroqMessage[];
  readonly temperature?: number;
  readonly max_tokens?: number;
  readonly top_p?: number;
  readonly n?: number;
  readonly stop?: string[];
  readonly frequency_penalty?: number;
  readonly presence_penalty?: number;
  readonly reasoning_effort?: GroqReasoningEffort;
  readonly response_format?: { readonly type: "json_object" };
  readonly stream?: boolean;
}

export type GroqFinishReason = "stop" | "length" | "content_filter";

export interface GroqChoice {
  readonly index: number;
  readonly message: {
    readonly role: "assistant";
    readonly content: string;
  };
  readonly finish_reason: GroqFinishReason;
  readonly logprobs: null | object;
}

export interface GroqUsage {
  readonly prompt_tokens: number;
  readonly completion_tokens: number;
  readonly total_tokens: number;
  readonly prompt_time?: number;
  readonly completion_time?: number;
  readonly total_time?: number;
}

export interface GroqChatResponse {
  readonly id: string;
  readonly object: string;
  readonly created: number;
  readonly model: string;
  readonly choices: GroqChoice[];
  readonly usage: GroqUsage;
  readonly system_fingerprint?: string;
  readonly x_groq?: {
    readonly id?: string;
    /** Present on the final chunk of a stream when usage accounting is enabled. */
    readonly usage?: GroqUsage;
  };
}

export interface GroqChunkChoice {
  readonly index: number;
  readonly delta: {
    readonly role?: "assistant";
    readonly content?: string;
  };
  readonly finish_reason: GroqFinishReason | null;
  readonly logprobs: null | object;
}

export interface GroqChatChunk {
  readonly id: string;
  readonly object: string;
  readonly created: number;
  readonly model: string;
  readonly choices: GroqChunkChoice[];
  readonly system_fingerprint?: string;
  readonly x_groq?: {
    readonly id?: string;
    readonly usage?: GroqUsage;
  };
}

export interface GroqErrorResponse {
  readonly error: {
    readonly message: string;
    readonly type: string;
    readonly code?: string;
  };
}

export interface StreamRequestOptions {
  readonly signal?: AbortSignal;
}
