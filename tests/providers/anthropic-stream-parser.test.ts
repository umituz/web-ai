import { describe, expect, it } from "vitest";
import {
  consumeAnthropicStream,
  mapAnthropicStopReason,
  sseFrame,
} from "../../src/providers/anthropic/anthropic-stream.parser";
import { AIError } from "../../src/core/errors";

const streamFromChunks = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index]));
      index += 1;
    },
  });
};

describe("consumeAnthropicStream", () => {
  it("emits text deltas and harvests model, tokens and stop reason", async () => {
    const events = [
      sseFrame({
        type: "message_start",
        message: { id: "msg_1", model: "claude-sonnet-5-5", usage: { input_tokens: 20, output_tokens: 1 } },
      }),
      `event: content_block_start\ndata: {"type":"content_block_start","index":0}\n\n`,
      sseFrame({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hel" } }),
      sseFrame({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "lo" } }),
      sseFrame({
        type: "message_delta",
        delta: { stop_reason: "end_turn" },
        usage: { input_tokens: 20, output_tokens: 4 },
      }),
      sseFrame({ type: "message_stop" }),
    ];

    const emitted: string[] = [];
    const outcome = await consumeAnthropicStream(streamFromChunks(events), {
      onChunk: (text) => emitted.push(text),
    });

    expect(emitted).toEqual(["Hel", "lo"]);
    expect(outcome.text).toBe("Hello");
    expect(outcome.model).toBe("claude-sonnet-5-5");
    expect(outcome.inputTokens).toBe(20);
    expect(outcome.outputTokens).toBe(4);
    expect(outcome.finishReason).toBe("stop");
  });

  it("carries refusal through as a flag, not an error", async () => {
    const events = [
      sseFrame({
        type: "message_start",
        message: { id: "msg_2", model: "claude-opus-5-5", usage: { input_tokens: 9, output_tokens: 1 } },
      }),
      sseFrame({
        type: "message_delta",
        delta: { stop_reason: "refusal" },
        usage: { input_tokens: 9, output_tokens: 1 },
      }),
      sseFrame({ type: "message_stop" }),
    ];

    const outcome = await consumeAnthropicStream(streamFromChunks(events), {});
    expect(outcome.text).toBe("");
    expect(outcome.finishReason).toBe("refusal");
  });

  it("throws AIError on an in-flight error event", async () => {
    const events = [
      sseFrame({
        type: "error",
        error: { type: "overloaded_error", message: "Overloaded" },
      }),
    ];

    await expect(consumeAnthropicStream(streamFromChunks(events), {})).rejects.toMatchObject({
      type: "SERVER_ERROR",
      message: "Overloaded",
    });
  });

  it("maps rate_limit_error to RATE_LIMIT_ERROR", async () => {
    const events = [
      sseFrame({
        type: "error",
        error: { type: "rate_limit_error", message: "slow down" },
      }),
    ];

    await expect(consumeAnthropicStream(streamFromChunks(events), {})).rejects.toBeInstanceOf(AIError);
    await expect(consumeAnthropicStream(streamFromChunks(events), {})).rejects.toMatchObject({
      type: "RATE_LIMIT_ERROR",
    });
  });

  it("preserves a delta line split across chunk boundaries", async () => {
    const payload = JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "split" } });
    const line = `data: ${payload}\n`;
    const cut = Math.floor(line.length / 2);
    const outcome = await consumeAnthropicStream(
      streamFromChunks([line.slice(0, cut), line.slice(cut)]),
      {},
    );
    expect(outcome.text).toBe("split");
  });
});

describe("mapAnthropicStopReason", () => {
  it("normalizes every stop reason", () => {
    expect(mapAnthropicStopReason("end_turn")).toBe("stop");
    expect(mapAnthropicStopReason("stop_sequence")).toBe("stop");
    expect(mapAnthropicStopReason("max_tokens")).toBe("length");
    expect(mapAnthropicStopReason("refusal")).toBe("refusal");
    expect(mapAnthropicStopReason(null)).toBeUndefined();
  });
});
