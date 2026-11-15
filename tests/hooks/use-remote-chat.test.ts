// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useRemoteChat } from "../../src/hooks/use-remote-chat";
import type { RemoteChatMessage } from "../../src/hooks/use-remote-chat";
import type {
  RemoteChatClient,
  RemoteChatStreamBody,
  RemoteStreamHandle,
} from "../../src/core/remote/remote-chat-client";
import type { StreamCallbacks } from "../../src/core/sse/browser-sse-reader";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderHook<T>(hookFn: () => T): { result: { current: T }; unmount: () => void } {
  const result = {} as { current: T };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    result.current = hookFn();
    return null;
  }

  act(() => {
    root.render(React.createElement(TestComponent));
  });

  return {
    result,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

type Script = (cb: StreamCallbacks<{ id: string }>) => Promise<void>;

function mockClient(script: Script): RemoteChatClient {
  return {
    streamChat<TToolCall>(
      _conversationId: string,
      _body: RemoteChatStreamBody,
      cb: StreamCallbacks<TToolCall>,
    ): RemoteStreamHandle {
      const promise = script(cb as unknown as StreamCallbacks<{ id: string }>);
      return { promise, abort: () => undefined };
    },
    async resolveToolCall<TToolCall>(
      _conversationId: string,
      _toolCallId: string,
      _approved: boolean,
      cb: StreamCallbacks<TToolCall>,
    ) {
      await script(cb as unknown as StreamCallbacks<{ id: string }>);
      return true;
    },
  };
}

describe("useRemoteChat", () => {
  it("echoes the user message, streams deltas into the placeholder, and finalizes on done", async () => {
    const client = mockClient(async (cb) => {
      cb.onDelta("reasoning", "thinking");
      cb.onDelta("answer", "Hi");
      cb.onDelta("answer", "!");
      cb.onUsage?.({ inputTokens: 1, outputTokens: 2 });
      cb.onDone?.("msg_9");
    });
    const onStreamEnd = vi.fn();
    const { result } = renderHook(() => useRemoteChat<{ id: string }>({ client, onStreamEnd }));

    expect(result.current.messages).toEqual([]);
    expect(result.current.isStreaming).toBe(false);

    await act(async () => {
      await result.current.stream("c1", { mode: "append", content: "yo" }, { localUserContent: "yo" });
    });

    const messages = result.current.messages as RemoteChatMessage[];
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "user", content: "yo", status: "complete" });
    expect(messages.at(-1)).toMatchObject({
      id: "msg_9",
      role: "assistant",
      content: "Hi!",
      reasoning: "thinking",
      status: "complete",
      usage: { inputTokens: 1, outputTokens: 2 },
    });
    expect(result.current.isStreaming).toBe(false);
    expect(onStreamEnd).toHaveBeenCalledWith({ conversationId: "c1", stopped: false });
  });

  it("regenerate mode skips the user echo", async () => {
    const client = mockClient(async (cb) => {
      cb.onDelta("answer", "again");
      cb.onDone?.("msg_2");
    });
    const { result } = renderHook(() => useRemoteChat({ client }));

    await act(async () => {
      await result.current.stream("c1", { mode: "regenerate" });
    });

    const messages = result.current.messages as RemoteChatMessage[];
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ role: "assistant", content: "again" });
  });

  it("patches error status and code on stream failure", async () => {
    const client = mockClient(async (cb) => {
      cb.onError?.("upstream_error", "boom");
    });
    const { result } = renderHook(() => useRemoteChat({ client }));

    await act(async () => {
      await result.current.stream("c1", { mode: "append", content: "x" }, { localUserContent: "x" });
    });

    const messages = result.current.messages as RemoteChatMessage[];
    expect(messages.at(-1)).toMatchObject({
      status: "error",
      error: { code: "upstream_error", message: "boom" },
    });
  });

  it("abort() marks the stream stopped for onStreamEnd", async () => {
    let release: () => void = () => undefined;
    const client = mockClient(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const onStreamEnd = vi.fn();
    const { result } = renderHook(() => useRemoteChat({ client, onStreamEnd }));

    let streaming: Promise<void> = Promise.resolve();
    act(() => {
      streaming = result.current.stream("c1", { mode: "regenerate" });
    });
    expect(result.current.isStreaming).toBe(true);

    act(() => {
      result.current.abort();
    });
    await act(async () => {
      release();
      await streaming;
    });

    expect(onStreamEnd).toHaveBeenCalledWith({ conversationId: "c1", stopped: true });
  });

  it("forwards tool_call events and appends a placeholder on resolveToolCall", async () => {
    const seen: string[] = [];
    const client = mockClient(async (cb) => {
      cb.onToolCall?.({ id: "t1" } as never);
    });
    const { result } = renderHook(() =>
      useRemoteChat<{ id: string }>({
        client,
        onToolCall: (toolCall) => seen.push(toolCall.id),
      }),
    );

    await act(async () => {
      await result.current.resolveToolCall("c1", "t1", true);
    });

    expect(seen).toEqual(["t1"]);
    expect(result.current.isResolving).toBe(false);
  });

  it("setMessages/patchLast expose manual control", async () => {
    const client = mockClient(async () => undefined);
    const { result } = renderHook(() => useRemoteChat({ client }));

    act(() => {
      result.current.setMessages([
        { id: "a", role: "user", content: "q", reasoning: "", status: "complete", error: null, usage: null },
        { id: "b", role: "assistant", content: "", reasoning: "", status: "streaming", error: null, usage: null },
      ]);
    });
    act(() => {
      result.current.patchLast({ status: "stopped", content: "halted" });
    });
    const messages = result.current.messages as RemoteChatMessage[];
    expect(messages.at(-1)).toMatchObject({ id: "b", status: "stopped", content: "halted" });
  });
});
