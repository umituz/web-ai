// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useText } from "../../src/hooks/use-text.hook";
import type { ITextProvider } from "../../src/providers";
import type { GenerationResult } from "../../src/core/types";

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

function createMockEngine(response = "mock generated text"): ITextProvider {
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

describe("useText hook", () => {
  it("throws if no engine dependency is provided", () => {
    expect(() => {
      renderHook(() => useText({}, undefined as unknown as { engine: ITextProvider }));
    }).toThrow("useText requires an engine dependency");
  });

  it("generates text successfully", async () => {
    const engine = createMockEngine("Hello world");
    const { result, unmount } = renderHook(() => useText({}, { engine }));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toBeNull();

    let text: string | null = null;
    await act(async () => {
      text = await result.current.generate("Say hello");
    });

    expect(text).toBe("Hello world");
    expect(result.current.result).toBe("Hello world");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(engine.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "Say hello" }],
      }),
    );
    unmount();
  });

  it("supports cancel and allows subsequent generations without getting stuck", async () => {
    let resolveFirst: ((val: GenerationResult) => void) | null = null;
    const engine = createMockEngine();
    vi.spyOn(engine, "generate").mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useText({}, { engine }));

    // Start long-running generation
    act(() => {
      void result.current.generate("First call");
    });

    expect(result.current.isLoading).toBe(true);

    // Cancel it
    act(() => {
      result.current.cancel();
    });

    expect(result.current.isLoading).toBe(false);

    // Resolve after cancel (simulating aborted network call finishing)
    if (resolveFirst) {
      (resolveFirst as (val: GenerationResult) => void)({
        text: "too late",
        model: "mock",
        providerId: "mock",
      });
    }

    // Now call generate AGAIN!
    // In buggy implementations, the aborted controller persisted and all future calls returned null!
    let secondResult: string | null = null;
    await act(async () => {
      secondResult = await result.current.generate("Second call");
    });

    expect(secondResult).toBe("mock generated text");
    expect(result.current.result).toBe("mock generated text");
    expect(result.current.isLoading).toBe(false);

    unmount();
  });

  it("resets state properly", async () => {
    const engine = createMockEngine("some result");
    const { result, unmount } = renderHook(() => useText({}, { engine }));

    await act(async () => {
      await result.current.generate("hi");
    });

    expect(result.current.result).toBe("some result");

    act(() => {
      result.current.reset();
    });

    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);

    unmount();
  });

  it("streams chunks through callbacks", async () => {
    const engine = createMockEngine("chunk1chunk2");
    const { result, unmount } = renderHook(() => useText({}, { engine }));
    const receivedChunks: string[] = [];

    await act(async () => {
      await result.current.stream(
        "tell story",
        (chunk) => receivedChunks.push(chunk),
      );
    });

    expect(receivedChunks).toEqual(["chunk1chunk2"]);
    expect(result.current.result).toBe("chunk1chunk2");
    unmount();
  });
});
