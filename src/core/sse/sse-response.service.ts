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
  /** Provider-specific: pulls the displayable text delta out of an SSE payload. */
  readonly extractDelta: SseDeltaExtractor;
}

export function createSseResponse(
  openUpstream: () => Promise<ReadableStream<Uint8Array>>,
  options: SseResponseOptions,
): Response {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
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
      const consumeLine = (line: string): boolean => {
        const trimmed = line.trim();
        if (!isSseDataLine(trimmed)) return false;
        const payload = extractSseDataPayload(trimmed);
        if (isSseDoneMarker(payload)) return true;
        const text = options.extractDelta(payload);
        if (text) {
          delivered = true;
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
