
import type { FinishReason, StreamCallbacks } from "../../core/types";
import { AIError, AIErrorType } from "../../core/errors";
import { extractSseDataPayload, isSseDataLine } from "../../core/parsers";
import type {
  AnthropicStopReason,
  AnthropicStreamEvent,
} from "./anthropic.entities";

export function mapAnthropicStopReason(
  reason: AnthropicStopReason | null | undefined,
): FinishReason | undefined {
  if (reason === "end_turn") return "stop";
  if (reason === "stop_sequence") return "stop";
  if (reason === "max_tokens") return "length";
  if (reason === "refusal") return "refusal";
  return undefined;
}

export interface AnthropicStreamOutcome {
  readonly text: string;
  readonly model: string | null;
  readonly inputTokens: number | undefined;
  readonly outputTokens: number | undefined;
  readonly finishReason: FinishReason | undefined;
}

/**
 * Line-buffered SSE consumer for Anthropic stream events. Only `data:` lines
 * carry payloads (each JSON payload self-describes via `type`); `event:`
 * lines are ignored as decoration. Harvests the model from message_start,
 * output tokens + stop reason from message_delta, and input tokens from the
 * message_start usage block, so the final GenerationResult matches the
 * non-streaming shape.
 */
export async function consumeAnthropicStream(
  stream: ReadableStream<Uint8Array>,
  callbacks: Pick<StreamCallbacks, "onChunk">,
): Promise<AnthropicStreamOutcome> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let buffer = "";
  let model: string | null = null;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let finishReason: FinishReason | undefined;

  const consumeLine = (rawLine: string): void => {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    const trimmed = line.trim();
    if (trimmed.length === 0 || !isSseDataLine(trimmed)) return;
    const payload = extractSseDataPayload(trimmed);

    let event: AnthropicStreamEvent;
    try {
      event = JSON.parse(payload) as AnthropicStreamEvent;
    } catch {
      return;
    }

    switch (event.type) {
      case "message_start":
        model = event.message.model;
        if (event.message.usage?.input_tokens !== undefined) {
          inputTokens = event.message.usage.input_tokens;
        }
        break;
      case "content_block_delta":
        if (typeof event.delta.text === "string" && event.delta.text.length > 0) {
          chunks.push(event.delta.text);
          callbacks.onChunk?.(event.delta.text);
        }
        break;
      case "message_delta":
        if (event.delta?.stop_reason !== undefined && event.delta.stop_reason !== null) {
          finishReason = mapAnthropicStopReason(event.delta.stop_reason);
        }
        if (event.usage?.output_tokens !== undefined) {
          outputTokens = event.usage.output_tokens;
        }
        break;
      case "message_stop":
        break;
      case "error": {
        const errType = event.error.type;
        const mappedType =
          errType === "rate_limit_error"
            ? AIErrorType.RATE_LIMIT_ERROR
            : errType === "authentication_error"
              ? AIErrorType.INVALID_API_KEY
              : errType === "invalid_request_error"
                ? AIErrorType.CLIENT_ERROR
                : AIErrorType.SERVER_ERROR;
        throw new AIError(
          mappedType,
          event.error.message || "Anthropic stream failed mid-flight",
        );
      }
      default:
        break;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) consumeLine(line);
    }

    buffer += decoder.decode();
    if (buffer.length > 0) consumeLine(buffer);
  } catch (error) {
    if (error instanceof AIError) throw error;
    throw new AIError(
      AIErrorType.NETWORK_ERROR,
      "Stream was interrupted",
      error instanceof Error ? error : undefined,
    );
  } finally {
    reader.releaseLock();
  }

  return {
    text: chunks.join(""),
    model,
    inputTokens,
    outputTokens,
    finishReason,
  };
}

/** Fixture helper for tests: builds the SSE wire framing for one event. */
export function sseFrame(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
