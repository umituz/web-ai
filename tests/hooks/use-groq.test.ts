// @vitest-environment happy-dom
import { describe, expect, it, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useGroq, type UseGroqReturn } from "../../src/hooks/use-groq.hook";
import {
  configureProvider,
  resetProvider,
} from "../../src/providers/groq/groq-container";
import { TextGenerationService } from "../../src/providers/groq/text-generation.service";
import type { IGroqHttpClient } from "../../src/providers/groq/groq-interfaces";
import type { GroqChatRequest, GroqChatResponse } from "../../src/providers/groq/groq.entities";

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

function mockClient(reply = "groq response"): IGroqHttpClient {
  return {
    postChatCompletion: async (req: GroqChatRequest): Promise<GroqChatResponse> => ({
      id: "resp_1",
      object: "chat.completion",
      created: 0,
      model: req.model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: reply },
          finish_reason: "stop",
          logprobs: null,
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
    }),
    streamChatCompletion: async () => {
      throw new Error("stream not implemented in mock");
    },
    getApiKey: () => "gsk-mock-key-12345678901234567890",
    setApiKey: () => undefined,
    initialize: () => undefined,
    isInitialized: () => true,
    cancelPendingRequests: () => undefined,
    reset: () => undefined,
  };
}

describe("useGroq hook", () => {
  afterEach(() => {
    resetProvider();
  });

  it("throws when dependency is missing and configureProvider was not called", () => {
    expect(() => {
      renderHook(() => useGroq({}));
    }).toThrow("useGroq requires a TextGenerationService");
  });

  it("generates text with explicitly injected TextGenerationService", async () => {
    const service = new TextGenerationService(mockClient("custom answer"));
    const { result, unmount } = renderHook(() => useGroq({}, { textGeneration: service }));

    let res: string | null = null;
    await act(async () => {
      res = await result.current.generate("Hello Groq");
    });

    expect(res).toBe("custom answer");
    expect(result.current.result).toBe("custom answer");
    expect(result.current.error).toBeNull();
    unmount();
  });

  it("resolves service from configureProvider singleton when deps omitted", async () => {
    configureProvider({
      apiKey: "gsk_test123456789012345678901234567890",
    });

    const { result, unmount } = renderHook(() => useGroq({}));

    expect(result.current).toBeDefined();
    expect(typeof result.current.generate).toBe("function");
    unmount();
  });

  it("cancel() does not brick subsequent generate calls", async () => {
    const service = new TextGenerationService(mockClient("second attempt"));
    const { result, unmount } = renderHook(() => useGroq({}, { textGeneration: service }));

    act(() => {
      result.current.cancel();
    });

    let second: string | null = null;
    await act(async () => {
      second = await result.current.generate("Hello again");
    });

    expect(second).toBe("second attempt");
    unmount();
  });
});
