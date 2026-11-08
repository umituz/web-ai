// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { usePrunaGeneration } from "../../src/hooks/usePrunaGeneration";
import { usePrunaProxy } from "../../src/hooks/usePrunaProxy";
import * as generationModule from "../../src/providers/pruna/client/generation/services/generation.service";

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

describe("Pruna hooks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("usePrunaGeneration", () => {
    it("runs text-to-image generation successfully", async () => {
      vi.spyOn(generationModule, "generate").mockResolvedValue({
        url: "https://pruna.ai/image.png",
        model: "p-image",
      });

      const { result, unmount } = renderHook(() =>
        usePrunaGeneration("test-api-key"),
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.result).toBeNull();

      let res: unknown = null;
      await act(async () => {
        res = await result.current.run({
          model: "p-image",
          prompt: "A beautiful mountain",
          aspect_ratio: "1:1",
        });
      });

      expect(res).toEqual({
        url: "https://pruna.ai/image.png",
        model: "p-image",
      });
      expect(result.current.result).toEqual({
        url: "https://pruna.ai/image.png",
        model: "p-image",
      });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      unmount();
    });

    it("handles generation errors gracefully", async () => {
      vi.spyOn(generationModule, "generate").mockRejectedValue(
        new Error("Rate limited"),
      );

      const { result, unmount } = renderHook(() =>
        usePrunaGeneration("test-api-key"),
      );

      await act(async () => {
        await result.current.run({
          model: "p-image",
          prompt: "Fail prompt",
          aspect_ratio: "1:1",
        });
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe("Rate limited");
      expect(result.current.result).toBeNull();
      unmount();
    });
  });

  describe("usePrunaProxy", () => {
    it("proxies generation to backend endpoint", async () => {
      const fetchMock = vi.fn(async () =>
        new Response(
          JSON.stringify({ url: "https://backend.proxy/video.mp4", model: "p-video" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const { result, unmount } = renderHook(() =>
        usePrunaProxy({ proxyUrl: "/api/pruna-proxy" }),
      );

      let res: unknown = null;
      await act(async () => {
        res = await result.current.run({
          model: "p-image",
          prompt: "Waves on the beach",
          aspect_ratio: "16:9",
        });
      });

      expect(res).toEqual({
        url: "https://backend.proxy/video.mp4",
        model: "p-video",
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/pruna-proxy",
        expect.objectContaining({
          method: "POST",
        }),
      );
      unmount();
    });
  });
});
