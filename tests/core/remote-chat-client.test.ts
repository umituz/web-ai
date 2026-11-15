import { describe, expect, it, vi } from "vitest";
import { createRemoteChatClient } from "../../src/core/remote/remote-chat-client";
import { formatSseEvent } from "../../src/core/streaming/sse-response";
import type { StreamCallbacks } from "../../src/core/sse/browser-sse-reader";

function sseResponse(events: object[]): Response {
  const body = events.map((event) => formatSseEvent(event as never)).join("");
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

const URLS = {
  stream: (id: string) => `/api/conversations/${id}/stream`,
  resolveToolCall: (id: string, callId: string) =>
    `/api/conversations/${id}/tool-calls/${callId}/resolve`,
};

function recorder(): StreamCallbacks<never> & {
  events: string[];
} {
  const events: string[] = [];
  return {
    events,
    onDelta: (channel, text) => events.push(`delta:${channel}:${text}`),
    onUsage: (usage) => events.push(`usage:${usage.inputTokens}`),
    onToolCall: (toolCall) => events.push(`tool:${JSON.stringify(toolCall)}`),
    onDone: (messageId) => events.push(`done:${messageId}`),
    onError: (code, message) => events.push(`error:${code}:${message}`),
  };
}

describe("createRemoteChatClient", () => {
  it("POSTs the body and dispatches SSE events to callbacks", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) =>
      sseResponse([
        { type: "delta", channel: "answer", text: "Hello" },
        { type: "delta", channel: "reasoning", text: "thinking" },
        { type: "usage", usage: { inputTokens: 3, outputTokens: 7 } },
        { type: "done", messageId: "msg_1" },
      ]),
    );
    const client = createRemoteChatClient({ urls: URLS, fetchImpl: fetchImpl as unknown as typeof fetch });

    const cb = recorder();
    await client.streamChat("c1", { mode: "append", content: "hi" }, cb).promise;

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/conversations/c1/stream",
      expect.objectContaining({ method: "POST" }),
    );
    const streamCall = fetchImpl.mock.calls[0] ?? [];
    expect(JSON.parse((streamCall[1] as RequestInit).body as string)).toEqual({
      mode: "append",
      content: "hi",
    });
    expect(cb.events).toEqual([
      "delta:answer:Hello",
      "delta:reasoning:thinking",
      "usage:3",
      "done:msg_1",
    ]);
  });

  it("surfaces the code+message from a JSON error body on non-ok", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "Nope", code: "model_unavailable" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
    );
    const client = createRemoteChatClient({ urls: URLS, fetchImpl: fetchImpl as unknown as typeof fetch });

    const cb = recorder();
    await client.streamChat("c1", {}, cb).promise;

    expect(cb.events).toEqual(["error:model_unavailable:Nope"]);
  });

  it("reports an empty body as request_failed", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const client = createRemoteChatClient({ urls: URLS, fetchImpl: fetchImpl as unknown as typeof fetch });

    const cb = recorder();
    await client.streamChat("c1", {}, cb).promise;
    expect(cb.events).toEqual(["error:request_failed:The server returned an empty stream."]);
  });

  it("abort() cancels the in-flight request", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const client = createRemoteChatClient({ urls: URLS, fetchImpl: fetchImpl as unknown as typeof fetch });

    const handle = client.streamChat("c1", {}, recorder());
    handle.abort();
    await expect(handle.promise).rejects.toThrow("Aborted");
  });

  it("resolveToolCall consumes a continuation stream and resolves true", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) =>
      sseResponse([
        { type: "delta", channel: "answer", text: "continued" },
        { type: "done", messageId: "msg_2" },
      ]),
    );
    const client = createRemoteChatClient({ urls: URLS, fetchImpl: fetchImpl as unknown as typeof fetch });

    const cb = recorder();
    const streamed = await client.resolveToolCall("c1", "t9", true, cb);

    expect(streamed).toBe(true);
    const resolveCall = fetchImpl.mock.calls[0] ?? [];
    expect(resolveCall[0]).toBe("/api/conversations/c1/tool-calls/t9/resolve");
    expect(JSON.parse((resolveCall[1] as RequestInit).body as string)).toEqual({
      approved: true,
    });
    expect(cb.events).toEqual(["delta:answer:continued", "done:msg_2"]);
  });

  it("resolveToolCall resolves false on error responses and non-SSE answers", async () => {
    const failing = createRemoteChatClient({
      urls: URLS,
      fetchImpl: vi.fn(
        async (_url: string, _init?: RequestInit) =>
          new Response(JSON.stringify({ error: "denied", code: "invalid_request" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          }),
      ) as unknown as typeof fetch,
    });
    const cb1 = recorder();
    await expect(failing.resolveToolCall("c1", "t1", false, cb1)).resolves.toBe(false);
    expect(cb1.events).toEqual(["error:invalid_request:denied"]);

    const jsonAnswer = createRemoteChatClient({
      urls: URLS,
      fetchImpl: vi.fn(async (_url: string, _init?: RequestInit) => new Response("{}", { status: 200 })) as unknown as typeof fetch,
    });
    await expect(jsonAnswer.resolveToolCall("c1", "t2", true, recorder())).resolves.toBe(false);
  });
});
