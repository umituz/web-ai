import {
  extractSseDataPayload,
  isSseDataLine,
  isSseDoneMarker,
} from "../parsers/sse-lines";
import type { SseDeltaExtractor } from "../parsers/streaming-response.parser";

export const SSE_BRIDGE_EVENTS = {
  delta: "delta",
  done: "done",
  error: "error",
} as const;

export interface SseResponseOptions {
  readonly donePayload: unknown;
  readonly errorCode: (error: unknown) => string;
  readonly onStreamFailure?: (error: unknown) => Promise<void> | void;
  readonly onComplete?: (assistantText: string) => Promise<void> | void;
  readonly extractDelta?: SseDeltaExtractor;
}

export function defaultSseDeltaExtractor(payload: string): string | null {
  try {
    const parsed = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string | null } }>;
      delta?: { text?: string };
      text?: string;
    };
    const content = parsed.choices?.[0]?.delta?.content;
    if (typeof content === "string" && content.length > 0) return content;
    if (typeof parsed.delta?.text === "string" && parsed.delta.text.length > 0) return parsed.delta.text;
    if (typeof parsed.text === "string" && parsed.text.length > 0) return parsed.text;
    return null;
  } catch {
    return null;
  }
}

export async function withCompletionTap(
  openUpstream: () => Promise<ReadableStream<Uint8Array>>,
  onComplete?: (assistantText: string) => void | Promise<void>,
  extractDelta: SseDeltaExtractor = defaultSseDeltaExtractor,
): Promise<ReadableStream<Uint8Array>> {
  if (!onComplete) return openUpstream();
  const reader = (await openUpstream()).getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let assistantText = "";

  const tapLine = (line: string): void => {
    const match = /^data:(.*)$/.exec(line);
    if (!match) return;
    const payload = match[1]?.trim();
    if (!payload || payload === "[DONE]") return;
    const delta = extractDelta(payload);
    if (typeof delta === "string") assistantText += delta;
  };

  const tap = (text: string, flush: boolean): void => {
    pending += text;
    for (;;) {
      const newlineIndex = pending.indexOf("\n");
      if (newlineIndex === -1) break;
      const line = pending.slice(0, newlineIndex);
      pending = pending.slice(newlineIndex + 1);
      tapLine(line);
    }
    if (flush && pending.length > 0) {
      tapLine(pending);
      pending = "";
    }
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          tap(decoder.decode(), true);
          try {
            await onComplete(assistantText);
          } catch (err) {
            console.warn("withCompletionTap onComplete failed:", err);
          }
          controller.close();
          return;
        }
        tap(decoder.decode(value, { stream: true }), false);
        controller.enqueue(value);
      } catch (err) {
        controller.error(err);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
}

export function createSseResponse(
  openUpstream: () => Promise<ReadableStream<Uint8Array>>,
  options: SseResponseOptions,
): Response {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const extractDelta = options.extractDelta ?? defaultSseDeltaExtractor;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          closed = true;
        }
      };
      let delivered = false;
      let accumulatedText = "";
      const consumeLine = (line: string): boolean => {
        const trimmed = line.trim();
        if (!isSseDataLine(trimmed)) return false;
        const payload = extractSseDataPayload(trimmed);
        if (isSseDoneMarker(payload)) return true;
        const text = extractDelta(payload);
        if (text) {
          delivered = true;
          accumulatedText += text;
          emit(SSE_BRIDGE_EVENTS.delta, { text });
        }
        return false;
      };
      try {
        const upstream = await openUpstream();
        const reader = upstream.getReader();
        let buffer = "";
        let finished = false;
        while (!finished) {
          const { value, done: readerDone } = await reader.read();
          if (readerDone) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            finished = consumeLine(line);
            if (finished) break;
          }
        }
        if (!finished && buffer.length > 0) consumeLine(buffer);
        if (options.onComplete) {
          try {
            await options.onComplete(accumulatedText);
          } catch (hookErr) {
            console.warn("onComplete callback failed:", hookErr);
          }
        }
        emit(SSE_BRIDGE_EVENTS.done, options.donePayload);
        finish();
      } catch (err) {
        if (!delivered && options.onStreamFailure) {
          await options.onStreamFailure(err);
        }
        emit(SSE_BRIDGE_EVENTS.error, { code: options.errorCode(err) });
        finish();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
