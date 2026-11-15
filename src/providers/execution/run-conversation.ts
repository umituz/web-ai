/**
 * Conversation runner — the generic engine behind a server-side chat
 * endpoint.
 *
 * Given an ordered list of attempts (adapter + model + sampling settings)
 * it streams a turn to completion: per-attempt context windowing, answer /
 * reasoning / usage / tool-call reduction, transient-error failover between
 * attempts, and abort handling. It is persistence-free — consumers react to
 * the yielded events (save the message, record usage, surface tool calls)
 * however their storage requires.
 */
import { buildContext } from "../../core/context/context-manager";
import type { ContextMessage } from "../../core/context/context-manager";
import { AiError, errorFromUnknown } from "../../core/errors";
import type { AiErrorCode } from "../../core/errors";
import { canFailover } from "../../core/utils";
import type { TokenUsage } from "../../core/types";
import type {
  AssistantToolCall,
  ChatAdapter,
  RequestImage,
  ToolDefinition,
} from "../adapters/adapter.types";

export interface ConversationAttemptModel {
  /** Model id as the provider API knows it. */
  readonly externalModelId: string;
  /** Context window in tokens; drives history windowing per attempt. */
  readonly contextWindow: number;
}

export interface ConversationAttemptSettings {
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly topP?: number;
}

export interface ConversationAttempt {
  readonly adapter: ChatAdapter;
  readonly model: ConversationAttemptModel;
  readonly settings: ConversationAttemptSettings;
}

export interface RunConversationInput<M extends ContextMessage = ContextMessage> {
  /** Conversation history, oldest first. Tool roles / toolCalls are
   *  preserved so follow-up turns after tool execution stay coherent. */
  readonly history: ReadonlyArray<M>;
  readonly systemPrompt: string;
  /** Ordered failover chain: attempts[0] is primary; later entries are
   *  tried only after a transient error with nothing streamed yet. */
  readonly attempts: ReadonlyArray<ConversationAttempt>;
  readonly tools?: ReadonlyArray<ToolDefinition>;
  readonly images?: ReadonlyArray<RequestImage>;
  readonly signal?: AbortSignal;
}

/** Everything accumulated during the attempt that ended the turn. */
export interface ConversationTurnResult {
  readonly answer: string;
  readonly reasoning: string;
  readonly usage: TokenUsage | null;
  readonly toolCalls: ReadonlyArray<AssistantToolCall>;
  readonly durationMs: number;
}

export type ConversationEvent =
  | { readonly type: "attempt"; readonly index: number }
  | { readonly type: "delta"; readonly channel: "answer" | "reasoning"; readonly text: string }
  /** The consumer aborted mid-stream; persist partials as "stopped". */
  | { readonly type: "stopped"; readonly result: ConversationTurnResult }
  /** All attempts are exhausted (or the error was non-transient). */
  | {
      readonly type: "failed";
      readonly code: AiErrorCode;
      readonly message: string;
      readonly result: ConversationTurnResult;
    }
  /** The model requested tool calls while tools were offered. */
  | { readonly type: "tool_calls"; readonly result: ConversationTurnResult }
  | { readonly type: "done"; readonly result: ConversationTurnResult };

export async function* runConversation<M extends ContextMessage = ContextMessage>(
  input: RunConversationInput<M>,
): AsyncGenerator<ConversationEvent> {
  const tools =
    input.tools && input.tools.length > 0 ? { tools: input.tools } : {} as const;
  const images =
    input.images && input.images.length > 0 ? { images: input.images } : {} as const;

  for (const [index, attempt] of input.attempts.entries()) {
    let answer = "";
    let reasoning = "";
    let usage: TokenUsage | null = null;
    let toolCalls: AssistantToolCall[] = [];
    const startedAt = Date.now();
    const context = buildContext(input.history, input.systemPrompt, {
      contextWindow: attempt.model.contextWindow,
      // No explicit output reservation → keep the whole window for input.
      maxOutputTokens: attempt.settings.maxOutputTokens ?? 0,
    });

    yield { type: "attempt", index };

    try {
      for await (const event of attempt.adapter.stream({
        externalModelId: attempt.model.externalModelId,
        messages: context,
        temperature: attempt.settings.temperature,
        maxOutputTokens: attempt.settings.maxOutputTokens,
        topP: attempt.settings.topP,
        ...tools,
        ...images,
        signal: input.signal,
      })) {
        if (event.type === "delta") {
          if (event.channel === "reasoning") reasoning += event.text;
          else answer += event.text;
          yield { type: "delta", channel: event.channel, text: event.text };
        } else if (event.type === "tool_calls") {
          toolCalls = [...event.calls];
        } else {
          usage = event.usage;
        }
      }
    } catch (err) {
      const result: ConversationTurnResult = {
        answer,
        reasoning,
        usage,
        toolCalls,
        durationMs: Date.now() - startedAt,
      };

      if (input.signal?.aborted === true) {
        yield { type: "stopped", result };
        return;
      }

      if (index + 1 < input.attempts.length && canFailover(err, answer.length + reasoning.length)) {
        continue;
      }

      const aiError = err instanceof AiError ? err : errorFromUnknown(err);
      yield { type: "failed", code: aiError.code, message: aiError.userMessage, result };
      return;
    }

    const result: ConversationTurnResult = {
      answer,
      reasoning,
      usage,
      toolCalls,
      durationMs: Date.now() - startedAt,
    };

    if (toolCalls.length > 0 && input.tools && input.tools.length > 0) {
      yield { type: "tool_calls", result };
      return;
    }

    yield { type: "done", result };
    return;
  }
}
