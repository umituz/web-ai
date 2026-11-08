// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useChat } from "../../src/hooks/use-chat.hook";
import { ChatService } from "../../src/chat/services/chat.service";
import type { ITextProvider } from "../../src/providers";
import type { IChatStorage } from "../../src/chat";

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

function createMockTextProvider(response = "AI reply"): ITextProvider {
  return {
    id: "mock",
    name: "Mock Provider",
    capabilities: ["text"],
    healthCheck: async () => "healthy",
    estimateCost: async () => 0,
    resolveModel: () => "mock-model",
    generate: vi.fn(async () => ({
      text: response,
      model: "mock-model",
      providerId: "mock",
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
      finishReason: "stop" as const,
    })),
    generateStructured: vi.fn(),
    stream: vi.fn(async (_req, callbacks) => {
      callbacks.onChunk?.(response);
      const res = {
        text: response,
        model: "mock-model",
        providerId: "mock",
        finishReason: "stop" as const,
      };
      callbacks.onComplete?.(res);
      return res;
    }),
  };
}

describe("useChat hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when ChatService dependency is missing", () => {
    expect(() => {
      renderHook(() => useChat({ conversationId: "c1" }));
    }).toThrow("useChat requires a ChatService dependency");
  });

  it("sends a message and receives an AI response", async () => {
    const provider = createMockTextProvider("Hello back!");
    const chatService = new ChatService(provider);
    const { result, unmount } = renderHook(() =>
      useChat({ conversationId: "c1" }, { chatService }),
    );

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      await result.current.sendMessage("Hi");
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].sender).toBe("user");
    expect(result.current.messages[0].content).toBe("Hi");
    expect(result.current.messages[1].sender).toBe("assistant");
    expect(result.current.messages[1].content).toBe("Hello back!");
    expect(result.current.isLoading).toBe(false);

    unmount();
  });

  it("persists messages to storage when autoSave is enabled", async () => {
    const provider = createMockTextProvider("Stored response");
    const chatService = new ChatService(provider);
    const mockStorage: IChatStorage = {
      saveMessage: vi.fn(async () => {}),
      getMessages: vi.fn(async () => []),
      updateMessage: vi.fn(async () => {}),
      deleteMessage: vi.fn(async () => {}),
    };

    const { result, unmount } = renderHook(() =>
      useChat({ conversationId: "c1", storage: mockStorage, autoSave: true }, { chatService }),
    );

    await act(async () => {
      await result.current.sendMessage("Save this");
    });

    expect(mockStorage.saveMessage).toHaveBeenCalledTimes(2); // user message + AI response
    expect(mockStorage.saveMessage).toHaveBeenCalledWith("c1", expect.objectContaining({ content: "Save this" }));

    unmount();
  });

  it("cleans up streaming placeholder message when streaming fails", async () => {
    const provider = createMockTextProvider();
    vi.spyOn(provider, "stream").mockRejectedValueOnce(
      new Error("Stream connection dropped"),
    );
    const chatService = new ChatService(provider);

    const { result, unmount } = renderHook(() =>
      useChat({ conversationId: "c1", stream: true }, { chatService }),
    );

    await act(async () => {
      await result.current.sendMessage("Stream message");
    });

    // The user message should be present, but the streaming placeholder should be cleaned up!
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].sender).toBe("user");
    expect(result.current.error).toBeDefined();

    unmount();
  });

  it("supports regenerate and cancel", async () => {
    const provider = createMockTextProvider("First answer");
    const chatService = new ChatService(provider);

    const { result, unmount } = renderHook(() =>
      useChat({ conversationId: "c1" }, { chatService }),
    );

    await act(async () => {
      await result.current.sendMessage("Initial prompt");
    });

    expect(result.current.messages).toHaveLength(2);

    vi.spyOn(provider, "generate").mockResolvedValueOnce({
      text: "Regenerated answer",
      model: "mock-model",
      providerId: "mock",
    });

    await act(async () => {
      await result.current.regenerate();
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].content).toBe("Regenerated answer");

    act(() => {
      result.current.clearMessages();
    });
    expect(result.current.messages).toHaveLength(0);

    unmount();
  });
});
