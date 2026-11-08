
import type { TextRequest } from "../../core/types";
import { ANTHROPIC_DEFAULT_EFFORT, ANTHROPIC_DEFAULT_MAX_TOKENS } from "./anthropic.constants";
import type {
  AnthropicEffort,
} from "./anthropic.constants";
import type {
  AnthropicMessage,
  AnthropicMessagesRequest,
} from "./anthropic.entities";

/**
 * Builds Messages API requests from neutral TextRequests.
 *
 * Wire rules enforced here (anthropic-version 2026-10-21):
 *  - `max_tokens` is always set — the API rejects requests without it.
 *  - temperature/top_p are NEVER emitted. This API version rejects them with
 *    a 400 even when copied straight from the request; they stay hints on
 *    TextRequest for providers that still honor sampling.
 *  - `systemPrompt` maps to the top-level `system` slot, not an in-band message.
 *  - `thinking` is omitted — adaptive thinking is the API's default.
 *  - `output_config.effort` defaults per model (opus/haiku medium, sonnet high)
 *    unless the caller pinned one on provider config.
 */
export class AnthropicRequestBuilder {
  private readonly model: string;
  private messages: AnthropicMessage[] = [];
  private systemPrompt: string | undefined;
  private maxTokens: number = ANTHROPIC_DEFAULT_MAX_TOKENS;
  private effort: AnthropicEffort | undefined;
  private stopSequences: string[] | undefined;
  private streamEnabled = false;

  constructor(model: string) {
    this.model = model;
  }

  static for(model: string): AnthropicRequestBuilder {
    return new AnthropicRequestBuilder(model);
  }

  withRequest(request: TextRequest): this {
    this.messages = toAnthropicMessages(request.messages);
    this.systemPrompt = request.systemPrompt;
    if (request.maxTokens !== undefined) this.maxTokens = request.maxTokens;
    if (request.stopSequences !== undefined && request.stopSequences.length > 0) {
      this.stopSequences = [...request.stopSequences];
    }
    return this;
  }

  withEffort(effort: AnthropicEffort | undefined): this {
    this.effort = effort;
    return this;
  }

  withStream(stream: boolean): this {
    this.streamEnabled = stream;
    return this;
  }

  withSystemPromptOverride(systemPrompt: string | undefined): this {
    this.systemPrompt = systemPrompt;
    return this;
  }

  withMessagesOverride(messages: AnthropicMessage[]): this {
    this.messages = messages;
    return this;
  }

  build(): AnthropicMessagesRequest {
    const request: {
      model: string;
      messages: AnthropicMessage[];
      max_tokens: number;
      system?: string;
      output_config?: { effort: AnthropicEffort };
      stop_sequences?: string[];
      stream?: boolean;
    } = {
      model: this.model,
      messages: this.messages,
      max_tokens: this.maxTokens,
      output_config: {
        effort: this.effort ?? defaultEffortForModel(this.model),
      },
    };

    if (this.systemPrompt !== undefined && this.systemPrompt.length > 0) {
      request.system = this.systemPrompt;
    }
    if (this.stopSequences !== undefined) {
      request.stop_sequences = this.stopSequences;
    }
    if (this.streamEnabled) {
      request.stream = true;
    }

    return request as AnthropicMessagesRequest;
  }
}

/**
 * Maps neutral messages to the wire format. System messages have no in-band
 * slot on this API — they are folded into the top-level system prompt, which
 * the caller sets separately.
 */
export function toAnthropicMessages(
  messages: ReadonlyArray<{ role: "system" | "user" | "assistant"; content: string }>,
): AnthropicMessage[] {
  return messages
    .filter((message) => message.role !== "system" && message.content.length > 0)
    .map((message) => ({
      role: message.role as AnthropicMessageRole,
      content: message.content,
    }));
}

type AnthropicMessageRole = "user" | "assistant";

export function defaultEffortForModel(model: string): AnthropicEffort {
  return ANTHROPIC_DEFAULT_EFFORT[model as keyof typeof ANTHROPIC_DEFAULT_EFFORT] ?? "medium";
}

/** Exported for the builder's max_tokens guarantee in tests. */
export const BUILDER_DEFAULT_MAX_TOKENS = ANTHROPIC_DEFAULT_MAX_TOKENS;
