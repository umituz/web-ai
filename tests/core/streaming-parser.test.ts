import { describe, expect, it } from "vitest";
import { StreamingResponseParser } from "../../src/core/parsers/streaming-response.parser";
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

function deltaPayload(content: string | null): string {
  return JSON.stringify({
    choices: [{ delta: content === null ? {} : { content } }],
  });
}

async function collect(chunks: string[]): Promise<{ full: string; emitted: string[] }> {
  const emitted: string[] = [];
  const parser = new StreamingResponseParser(
    { onChunk: (content) => emitted.push(content) },
    extractContentFromSsePayload,
  );
  const full = await parser.parse(streamFromChunks(chunks));
  return { full, emitted };
}

describe("StreamingResponseParser", () => {
  it("emits deltas from multiple lines in one chunk", async () => {
    const { full, emitted } = await collect([
      `data: ${deltaPayload("Hel")}\ndata: ${deltaPayload("lo")}\n\n`,
    ]);
    expect(emitted).toEqual(["Hel", "lo"]);
    expect(full).toBe("Hello");
  });

  it("preserves a data line split across chunks", async () => {
    const payload = deltaPayload("world");
    const line = `data: ${payload}\n`;
    const cut = Math.floor(line.length / 2);
    const { full, emitted } = await collect([line.slice(0, cut), line.slice(cut)]);
    expect(emitted).toEqual(["world"]);
    expect(full).toBe("world");
  });

  it("preserves a payload split inside the json body", async () => {
    const payload = deltaPayload("split json");
    const { full, emitted } = await collect([
      `data: ${payload.slice(0, 4)}`,
      `${payload.slice(4)}\n`,
    ]);
    expect(emitted).toEqual(["split json"]);
    expect(full).toBe("split json");
  });

  it("handles crlf line endings", async () => {
    const { full } = await collect([`data: ${deltaPayload("a")}\r\ndata: ${deltaPayload("b")}\r\n`]);
    expect(full).toBe("ab");
  });

  it("ignores done markers comments and non-data lines", async () => {
    const { full, emitted } = await collect([
      `: keepalive\nevent: message\ndata: ${deltaPayload("x")}\ndata: [DONE]\n`,
    ]);
    expect(emitted).toEqual(["x"]);
    expect(full).toBe("x");
  });

  it("ignores deltas without content such as finish chunks", async () => {
    const { full, emitted } = await collect([
      `data: ${deltaPayload("tail")}\ndata: ${deltaPayload(null)}\n`,
    ]);
    expect(emitted).toEqual(["tail"]);
    expect(full).toBe("tail");
  });

  it("emits a final line without trailing newline", async () => {
    const { full, emitted } = await collect([`data: ${deltaPayload("end")}`]);
    expect(emitted).toEqual(["end"]);
    expect(full).toBe("end");
  });

  it("returns empty string for a stream with no data lines", async () => {
    const { full, emitted } = await collect([": only a comment\n\n"]);
    expect(emitted).toEqual([]);
    expect(full).toBe("");
  });

  it("carries a multi-byte character split across chunks", async () => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(`data: ${deltaPayload("ü")}\n`);
    const cut = bytes.length - 1;
    const head = bytes.slice(0, cut);
    const tail = bytes.slice(cut);
    const emitted: string[] = [];
    const parser = new StreamingResponseParser(
      { onChunk: (content) => emitted.push(content) },
      extractContentFromSsePayload,
    );
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(head);
        controller.enqueue(tail);
        controller.close();
      },
    });
    const full = await parser.parse(stream);
    expect(full).toBe("ü");
    expect(emitted).toEqual(["ü"]);
  });
});
