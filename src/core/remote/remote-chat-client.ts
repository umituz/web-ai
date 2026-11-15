/**
 * Remote SSE chat client — the browser/edge counterpart of
 * `sseStreamResponse`.
 *
 * While `useChat` talks to providers directly (needs an API key on the
 * client), most real apps proxy chat through their own backend: the browser
 * POSTs to `/conversations/:id/stream` and consumes the same SSE event
 * vocabulary the server produced with `sseStreamResponse`. This client
 * owns that fetch + read loop so apps do not hand-roll it.
 */
import { readSseResponse } from "../sse/browser-sse-reader";
import type { StreamCallbacks } from "../sse/browser-sse-reader";

/** Body the backend chat endpoint expects. Kept generic on purpose —
 *  `settings` is whatever the app's API contract defines. */
export interface RemoteChatStreamBody {
  readonly mode?: "append" | "regenerate";
  readonly content?: string;
  readonly modelId?: string;
  readonly settings?: Record<string, unknown>;
}

/** Endpoint templates; both are required so the client never guesses URL
 *  shapes. Example:
 *  `{ stream: (id) => \`/api/conversations/${id}/stream\`,
 *     resolveToolCall: (id, callId) => \`/api/conversations/${id}/tool-calls/${callId}/resolve\` }` */
export interface RemoteChatUrls {
  readonly stream: (conversationId: string) => string;
  readonly resolveToolCall: (conversationId: string, toolCallId: string) => string;
}

export interface RemoteChatClientOptions {
  readonly urls: RemoteChatUrls;
  readonly fetchImpl?: typeof fetch;
}

export interface RemoteStreamHandle {
  readonly promise: Promise<void>;
  abort(): void;
}

export interface RemoteChatClient {
  /** POST the chat request and dispatch the SSE stream to `callbacks`. */
  streamChat<TToolCall = unknown>(
    conversationId: string,
    body: RemoteChatStreamBody,
    callbacks: StreamCallbacks<TToolCall>,
  ): RemoteStreamHandle;
  /** Approve/reject a pending tool call. Resolves true when the server
   *  answered with a continuation stream (consumed into `callbacks`). */
  resolveToolCall<TToolCall = unknown>(
    conversationId: string,
    toolCallId: string,
    approved: boolean,
    callbacks: StreamCallbacks<TToolCall>,
  ): Promise<boolean>;
}

interface ErrorPayload {
  readonly error?: string;
  readonly code?: string;
}

async function surfaceHttpError(
  response: Response,
  callbacks: StreamCallbacks<unknown>,
): Promise<void> {
  const payload = (await response.json().catch(() => null)) as ErrorPayload | null;
  callbacks.onError?.(payload?.code ?? "request_failed", payload?.error ?? "Request failed");
}

export function createRemoteChatClient(options: RemoteChatClientOptions): RemoteChatClient {
  const doFetch = options.fetchImpl ?? fetch;
  const { urls } = options;

  return {
    streamChat<TToolCall>(
      conversationId: string,
      body: RemoteChatStreamBody,
      callbacks: StreamCallbacks<TToolCall>,
    ): RemoteStreamHandle {
      const controller = new AbortController();

      const promise = (async () => {
        const response = await doFetch(urls.stream(conversationId), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          await surfaceHttpError(response, callbacks as StreamCallbacks<unknown>);
          return;
        }
        if (!response.body) {
          callbacks.onError?.("request_failed", "The server returned an empty stream.");
          return;
        }

        await readSseResponse(response, callbacks);
      })();

      return {
        promise,
        abort: () => controller.abort(),
      };
    },

    async resolveToolCall<TToolCall>(
      conversationId: string,
      toolCallId: string,
      approved: boolean,
      callbacks: StreamCallbacks<TToolCall>,
    ): Promise<boolean> {
      const response = await doFetch(urls.resolveToolCall(conversationId, toolCallId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approved }),
      });

      if (!response.ok) {
        await surfaceHttpError(response, callbacks as StreamCallbacks<unknown>);
        return false;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/event-stream") || !response.body) {
        return false;
      }

      await readSseResponse(response, callbacks);
      return true;
    },
  };
}
