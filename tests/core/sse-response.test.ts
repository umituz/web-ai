import { describe, expect, it } from "vitest";
import { createSseResponse } from "../../src/core/sse/sse-response.service";
import { extractContentFromSsePayload } from "../../src/providers/groq/groq-sse";

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
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
}

function deltaPayload(content: string): string {
  return JSON.stringify({ choices: [{ delta: { content } }] });
}

function streamFailingAfter(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.error(new Error("upstream broke"));
        return;
      }
      controller.enqueue(encoder.encode(chunks[index]));
      index += 1;
    },
  });
}

async function readFrames(response: Response): Promise<string[]> {
  const text = await response.text();
  return text.split("\n\n").filter((frame) => frame.length > 0);
}

describe("createSseResponse", () => {
  it("emits delta frames and a done frame with the done payload", async () => {
    const response = createSseResponse(
      () => Promise.resolve(streamFromChunks([
        `data: ${deltaPayload("Hel")}\n\n`,
        `data: ${deltaPayload("lo")}\n\ndata: [DONE]\n\n`,
      ])),
      { extractDelta: extractContentFromSsePayload, donePayload: { remaining: 7 }, errorCode: () => "ai.error" },
    );
    const frames = await readFrames(response);
    expect(frames).toEqual([
      `event: delta\ndata: ${JSON.stringify({ text: "Hel" })}`,
      `event: delta\ndata: ${JSON.stringify({ text: "lo" })}`,
      `event: done\ndata: ${JSON.stringify({ remaining: 7 })}`,
    ]);
    expect(response.headers.get("content-type")).toBe(
      "text/event-stream; charset=utf-8",
    );
  });

  it("flushes a trailing buffered data line without a newline", async () => {
    const response = createSseResponse(
      () => Promise.resolve(streamFromChunks([`data: ${deltaPayload("tail")}`])),
      { extractDelta: extractContentFromSsePayload, donePayload: {}, errorCode: () => "ai.error" },
    );
    const frames = await readFrames(response);
    expect(frames).toEqual([
      `event: delta\ndata: ${JSON.stringify({ text: "tail" })}`,
      `event: done\ndata: {}`,
    ]);
  });

  it("defaults to standard delta extractor when extractDelta is omitted", async () => {
    const response = createSseResponse(
      () => Promise.resolve(streamFromChunks([`data: ${deltaPayload("default text")}`])),
      { donePayload: { ok: true }, errorCode: () => "ai.error" },
    );
    const frames = await readFrames(response);
    expect(frames).toEqual([
      `event: delta\ndata: ${JSON.stringify({ text: "default text" })}`,
      `event: done\ndata: ${JSON.stringify({ ok: true })}`,
    ]);
  });

  it("calls onStreamFailure and emits an error frame when nothing was delivered", async () => {
    const failures: unknown[] = [];
    const response = createSseResponse(() => Promise.resolve(streamFailingAfter([])), {
      extractDelta: extractContentFromSsePayload,
      donePayload: {},
      errorCode: () => "ai.error",
      onStreamFailure: (err) => {
        failures.push(err);
      },
    });
    const frames = await readFrames(response);
    expect(frames).toEqual([
      `event: error\ndata: ${JSON.stringify({ code: "ai.error" })}`,
    ]);
    expect(failures).toHaveLength(1);
  });

  it("skips onStreamFailure when a delta was already delivered", async () => {
    const failures: unknown[] = [];
    const response = createSseResponse(
      () => Promise.resolve(streamFailingAfter([`data: ${deltaPayload("partial")}\n\n`])),
      {
        extractDelta: extractContentFromSsePayload,
        donePayload: {},
        errorCode: () => "ai.error",
        onStreamFailure: (err) => {
          failures.push(err);
        },
      },
    );
    const frames = await readFrames(response);
    expect(frames).toEqual([
      `event: delta\ndata: ${JSON.stringify({ text: "partial" })}`,
      `event: error\ndata: ${JSON.stringify({ code: "ai.error" })}`,
    ]);
    expect(failures).toHaveLength(0);
  });

  it("ignores non-data lines and payloads without content", async () => {
    const response = createSseResponse(
      () => Promise.resolve(streamFromChunks([
        `event: ping\ndata: {}\n\ndata: {"choices":[{"delta":{}}]}\n\ndata: [DONE]\n\n`,
      ])),
      { extractDelta: extractContentFromSsePayload, donePayload: { ok: true }, errorCode: () => "ai.error" },
    );
    const frames = await readFrames(response);
    expect(frames).toEqual([
      `event: done\ndata: ${JSON.stringify({ ok: true })}`,
    ]);
  });

  it("emits an error frame when opening the upstream rejects", async () => {
    const failures: unknown[] = [];
    const response = createSseResponse(
      () => Promise.reject(new Error("rate limited")),
      {
        extractDelta: extractContentFromSsePayload,
        donePayload: {},
        errorCode: () => "ai.rateLimit",
        onStreamFailure: (err) => {
          failures.push(err);
        },
      },
    );
    const frames = await readFrames(response);
    expect(frames).toEqual([
      `event: error\ndata: ${JSON.stringify({ code: "ai.rateLimit" })}`,
    ]);
    expect(failures).toHaveLength(1);
  });
});
