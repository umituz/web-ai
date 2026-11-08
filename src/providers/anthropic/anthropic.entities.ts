
import type { TierModelMap } from "../../core/tiers";
import type { AnthropicEffort } from "./anthropic.constants";

/**
 * Anthropic Messages API wire types, pinned to anthropic-version 2026-10-21.
 * Two hard rules live here as types so the builder cannot violate them:
 *  - `max_tokens` is required on every request.
 *  - sampling parameters (temperature/top_p) are NOT part of this request
 *    shape — this API version rejects them with a 400.
 */

export interface AnthropicProviderConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  /** Per-tier model overrides; merged over ANTHROPIC_TIERS. */
  readonly models?: TierModelMap;
  /** Reasoning effort hint; defaults come from ANTHROPIC_DEFAULT_EFFORT per model. */
  readonly effort?: AnthropicEffort;
}

export type AnthropicMessageRole = "user" | "assistant";

export interface AnthropicMessage {
  readonly role: AnthropicMessageRole;
  readonly content: string;
}

export interface AnthropicOutputConfig {
  /** Reasoning effort: low | medium | high. Omitted when not specified. */
  readonly effort?: AnthropicEffort;
}

export interface AnthropicMessagesRequest {
  readonly model: string;
  readonly messages: AnthropicMessage[];
  /** Required — the API rejects requests without it. */
  readonly max_tokens: number;
  /** Top-level system prompt slot; preferred over in-band system messages. */
  readonly system?: string;
  readonly output_config?: AnthropicOutputConfig;
  readonly stop_sequences?: string[];
  readonly stream?: boolean;
}

export interface AnthropicTextBlock {
  readonly type: "text";
  readonly text: string;
}

export type AnthropicContentBlock = AnthropicTextBlock;

export type AnthropicStopReason =
  | "end_turn"
  | "max_tokens"
  | "stop_sequence"
  | "refusal";

export interface AnthropicUsage {
  readonly input_tokens: number;
  readonly output_tokens: number;
}

export interface AnthropicMessagesResponse {
  readonly id: string;
  readonly type: "message";
  readonly role: "assistant";
  readonly model: string;
  readonly content: AnthropicContentBlock[];
  readonly stop_reason: AnthropicStopReason | null;
  readonly stop_sequence: string | null;
  readonly usage: AnthropicUsage;
}

/* ---------- streaming events ---------- */

export interface AnthropicMessageStartEvent {
  readonly type: "message_start";
  readonly message: {
    readonly id: string;
    readonly model: string;
    readonly usage?: AnthropicUsage;
  };
}

export interface AnthropicContentBlockDeltaEvent {
  readonly type: "content_block_delta";
  readonly index: number;
  /** text_delta events carry text; other delta kinds (thinking etc.) don't. */
  readonly delta: {
    readonly type: string;
    readonly text?: string;
  };
}

export interface AnthropicMessageDeltaEvent {
  readonly type: "message_delta";
  readonly delta: {
    readonly stop_reason?: AnthropicStopReason | null;
  };
  readonly usage?: AnthropicUsage;
}

export interface AnthropicMessageStopEvent {
  readonly type: "message_stop";
}

export interface AnthropicErrorEvent {
  readonly type: "error";
  readonly error: {
    readonly type: string;
    readonly message: string;
  };
}

export type AnthropicStreamEvent =
  | AnthropicMessageStartEvent
  | AnthropicContentBlockDeltaEvent
  | AnthropicMessageDeltaEvent
  | AnthropicMessageStopEvent
  | AnthropicErrorEvent;

export interface AnthropicErrorResponse {
  readonly type: "error";
  readonly error: {
    readonly type: string;
    readonly message: string;
  };
}
