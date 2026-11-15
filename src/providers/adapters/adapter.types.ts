import type { TokenUsage } from '../../core/types';
import type { AssistantToolCall } from '../../core/sse/tool-call-accumulator';

export type { AssistantToolCall } from '../../core/sse/tool-call-accumulator';

export type AdapterChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AdapterChatMessage {
  readonly role: AdapterChatRole;
  readonly content: string;
  readonly toolCalls?: readonly AssistantToolCall[];
  readonly toolCallId?: string;
}

export interface RequestImage {
  readonly mimeType: string;
  readonly dataBase64: string;
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

export interface AdapterRequest {
  readonly externalModelId: string;
  readonly messages: readonly AdapterChatMessage[];
  /** Sampling hints — absent fields stay off the wire (undefined keys are
   *  dropped by JSON.stringify), matching callers that specify none. */
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly topP?: number;
  readonly tools?: readonly ToolDefinition[];
  readonly images?: readonly RequestImage[];
  readonly signal?: AbortSignal;
}

export type ProviderEvent =
  | { readonly type: 'delta'; readonly channel: 'answer' | 'reasoning'; readonly text: string }
  | { readonly type: 'usage'; readonly usage: TokenUsage }
  | { readonly type: 'tool_calls'; readonly calls: readonly AssistantToolCall[] };

export interface ChatAdapter {
  stream(req: AdapterRequest): AsyncIterable<ProviderEvent>;
}

export interface AdapterConfig {
  /** API root, e.g. https://api.openai.com/v1 — /chat/completions is appended. */
  readonly baseUrl?: string;
  /** Full endpoint URL; wins over baseUrl. Gateways (Cloudflare AI Gateway,
   *  OpenRouter proxies) hand out the complete chat-completions URL. */
  readonly endpointUrl?: string;
  readonly apiKey: string;
  readonly timeoutMs: number;
}
