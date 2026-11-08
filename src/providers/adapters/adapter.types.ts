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
  readonly temperature: number;
  readonly maxOutputTokens: number;
  readonly topP: number;
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
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly timeoutMs: number;
}
