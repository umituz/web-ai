import { describe, expect, it, vi } from "vitest";
import {
  createSseResponse,
  withCompletionTap,
} from "../../src/core/sse/sse-response.service";

describe("withCompletionTap", () => {
  it("accumulates assistant deltas and calls onComplete when stream ends", async () => {
    const onComplete = vi.fn();
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world!"}}]}\n\n',
      "data: [DONE]\n\n",
    ];

    const openUpstream = async () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        },
      });

    const tappedStream = await withCompletionTap(openUpstream, onComplete);
    const reader = tappedStream.getReader();
    const decoder = new TextDecoder();
    let streamOutput = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      streamOutput += decoder.decode(value);
    }

    expect(streamOutput).toContain("Hello");
    expect(streamOutput).toContain(" world!");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("Hello world!");
  });

  it("bypasses tapping if onComplete is not provided", async () => {
    const encoder = new TextEncoder();
    const openUpstream = async () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode("test chunk"));
          controller.close();
        },
      });

    const stream = await withCompletionTap(openUpstream);
    const reader = stream.getReader();
    const { value } = await reader.read();
    expect(new TextDecoder().decode(value)).toBe("test chunk");
  });
});

describe("createSseResponse with onComplete", () => {
  it("triggers onComplete callback with full accumulated assistant text", async () => {
    const onComplete = vi.fn();
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Greetings"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":", traveler."}}]}\n\n',
      "data: [DONE]\n\n",
    ];

    const openUpstream = async () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        },
      });

    const response = createSseResponse(openUpstream, {
      donePayload: { status: "ok" },
      errorCode: () => "error.unknown",
      onComplete,
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Missing response body");

    for (;;) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("Greetings, traveler.");
  });
});
