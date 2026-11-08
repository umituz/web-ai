
import type { FinishReason, StreamCallbacks, TokenUsage } from "../../core/types";
import { AIError, AIErrorType } from "../../core/errors";
import { extractSseDataPayload, isSseDataLine, isSseDoneMarker } from "../../core/parsers";
import type { GroqChatChunk, GroqErrorResponse, GroqUsage } from "./groq.entities";

/**
 * Extracts the displayable text delta from one Groq SSE `data:` payload.
 * Returns null for role-only chunks, finish-only chunks, and unparseable
 * payloads — the generic line machinery skips nulls.
 */
export function extractContentFromSsePayload(payload: string): string | null {
  try {
    const parsed = JSON.parse(payload) as GroqChatChunk;
    const delta = parsed.choices?.[0]?.delta?.content;
    return typeof delta === "string" && delta.length > 0 ? delta : null;
  } catch {
    return null;
  }
}

export function mapGroqFinishReason(reason: string | null | undefined): FinishReason | undefined {
  if (reason === "stop") return "stop";
  if (reason === "length") return "length";
  if (reason === "content_filter") return "content_filter";
  return undefined;
}

export function mapGroqUsage(usage: GroqUsage | undefined): TokenUsage | undefined {
  if (!usage) return undefined;
  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}

export interface GroqStreamOutcome {
  readonly text: string;
  readonly model: string | null;
  readonly finishReason: FinishReason | undefined;
  readonly usage: TokenUsage | undefined;
}

/**
 * Consumes a Groq SSE body: forwards text deltas through `callbacks.onChunk`
 * and harvests model/finish_reason/usage from the surrounding chunks so the
 * resulting GenerationResult is as complete as the non-streaming one.
 */
export async function consumeGroqStream(
  stream: ReadableStream<Uint8Array>,
  callbacks: Pick<StreamCallbacks, "onChunk">,
): Promise<GroqStreamOutcome> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let buffer = "";
  let model: string | null = null;
  let finishReason: FinishReason | undefined;
  let usage: TokenUsage | undefined;

  const consumeLine = (rawLine: string): void => {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    const trimmed = line.trim();
    if (trimmed.length === 0 || !isSseDataLine(trimmed)) return;
    const payload = extractSseDataPayload(trimmed);
    if (isSseDoneMarker(payload)) return;

    let chunk: GroqChatChunk;
    try {
      chunk = JSON.parse(payload) as GroqChatChunk;
    } catch {
      return;
    }

    if (chunk.model) model = chunk.model;

    const choice = chunk.choices?.[0];
    const delta = choice?.delta?.content;
    if (typeof delta === "string" && delta.length > 0) {
      chunks.push(delta);
      callbacks.onChunk?.(delta);
    }
    if (choice?.finish_reason) {
      finishReason = mapGroqFinishReason(choice.finish_reason);
    }
    const tailUsage = chunk.x_groq?.usage;
    if (tailUsage) {
      usage = mapGroqUsage(tailUsage);
    }

    const errorBody = (chunk as unknown as GroqErrorResponse).error;
    if (errorBody) {
      throw new AIError(
        AIErrorType.SERVER_ERROR,
        errorBody.message || "Groq stream failed mid-flight",
      );
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

  return { text: chunks.join(""), model, finishReason, usage };
}
