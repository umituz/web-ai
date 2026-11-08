import { afterEach, describe, expect, it, vi } from "vitest";
import { GroqProvider } from "../../src/providers/groq/groq.provider";
import { GROQ_MODELS } from "../../src/providers/groq/groq.constants";
import type { GroqChatResponse } from "../../src/providers/groq/groq.entities";

function chatResponse(overrides: Partial<GroqChatResponse> = {}): GroqChatResponse {
  return {
    id: "chatcmpl-1",
    object: "chat.completion",
    created: 1_700_000_000,
    model: "llama-3.3-70b-versatile",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "Hello there" },
        finish_reason: "stop",
        logprobs: null,
      },
    ],
    usage: {
      prompt_tokens: 12,
      completion_tokens: 34,
      total_tokens: 46,
    },
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** RequestInit of the first captured fetch call — the wire assertion helper. */
const sentInit = (
  fetchMock: { mock: { calls: Array<[url: RequestInfo | URL, init?: RequestInit]> } },
): RequestInit => fetchMock.mock.calls[0]?.[1] ?? ({} as RequestInit);

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

describe("GroqProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a GenerationResult with normalized token usage", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(chatResponse()));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GroqProvider({ apiKey: "gsk-test" });
    const result = await provider.generate({
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result.text).toBe("Hello there");
    expect(result.providerId).toBe("groq");
    expect(result.model).toBe("llama-3.3-70b-versatile");
    expect(result.finishReason).toBe("stop");
    expect(result.usage).toEqual({
      inputTokens: 12,
      outputTokens: 34,
      totalTokens: 46,
    });
  });

  it("resolves neutral tiers onto groq models and lets explicit model win", () => {
    const provider = new GroqProvider({ apiKey: "gsk-test" });
    expect(provider.resolveModel("fast")).toBe(GROQ_MODELS.LLAMA_3_1_8B_INSTANT);
    expect(provider.resolveModel("balanced")).toBe(GROQ_MODELS.LLAMA_3_3_70B_VERSATILE);
    expect(provider.resolveModel("powerful")).toBe(GROQ_MODELS.GPT_OSS_120B);
  });

  it("applies per-instance model overrides", () => {
    const provider = new GroqProvider({
      apiKey: "gsk-test",
      models: { balanced: "custom-model" },
    });
    expect(provider.resolveModel("balanced")).toBe("custom-model");
  });

  it("sends tier-resolved model, system prompt and sampling on the wire", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(chatResponse()),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GroqProvider({ apiKey: "gsk-test" });
    await provider.generate({
      messages: [
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
        { role: "user", content: "bye" },
      ],
      systemPrompt: "be terse",
      tier: "fast",
      temperature: 0.3,
      maxTokens: 128,
    });

    const body = JSON.parse(sentInit(fetchMock).body as string);
    expect(body.model).toBe(GROQ_MODELS.LLAMA_3_1_8B_INSTANT);
    expect(body.messages[0]).toEqual({ role: "system", content: "be terse" });
    expect(body.messages).toHaveLength(4);
    expect(body.temperature).toBe(0.3);
    expect(body.max_tokens).toBe(128);
  });

  it("caches identical generations and returns the same result twice", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(chatResponse()));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GroqProvider({ apiKey: "gsk-test" });
    const request = { messages: [{ role: "user" as const, content: "cached?" }] };
    const first = await provider.generate(request);
    const second = await provider.generate(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it("streams deltas and harvests finish reason and tail usage", async () => {
    const chunks = [
      `data: ${JSON.stringify({ id: "c1", model: "llama-3.3-70b-versatile", choices: [{ index: 0, delta: { content: "Hel" }, finish_reason: null }] })}\n\n`,
      `data: ${JSON.stringify({ id: "c1", model: "llama-3.3-70b-versatile", choices: [{ index: 0, delta: { content: "lo" }, finish_reason: "stop" }], x_groq: { usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 } } })}\n\n`,
      "data: [DONE]\n\n",
    ];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(streamFromChunks(chunks))));

    const provider = new GroqProvider({ apiKey: "gsk-test" });
    const emitted: string[] = [];
    let completed = false;
    const result = await provider.stream(
      { messages: [{ role: "user", content: "hi" }] },
      {
        onChunk: (chunk) => emitted.push(chunk),
        onComplete: () => {
          completed = true;
        },
      },
    );

    expect(emitted).toEqual(["Hel", "lo"]);
    expect(result.text).toBe("Hello");
    expect(result.finishReason).toBe("stop");
    expect(result.usage).toEqual({ inputTokens: 5, outputTokens: 2, totalTokens: 7 });
    expect(completed).toBe(true);
  });

  it("parses structured JSON responses with schema embedded in the prompt", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(
        chatResponse({
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: '```json\n{"title":"T"}\n```' },
              finish_reason: "stop",
              logprobs: null,
            },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GroqProvider({ apiKey: "gsk-test" });
    const { value, result } = await provider.generateStructured<{ title: string }>({
      messages: [{ role: "user", content: "make a title" }],
      schema: { type: "object", properties: { title: { type: "string" } } },
    });

    expect(value).toEqual({ title: "T" });
    expect(result.usage?.totalTokens).toBe(46);

    const body = JSON.parse(sentInit(fetchMock).body as string);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages.at(-1).content).toContain("Expected JSON schema");
  });

  it("maps HTTP 401 to INVALID_API_KEY with status metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: { message: "invalid api key", type: "invalid_request_error" } }, 401),
      ),
    );

    const provider = new GroqProvider({ apiKey: "bad" });
    const error = await provider.generate({ messages: [{ role: "user", content: "x" }] }).catch((e) => e);
    expect(error.type).toBe("INVALID_API_KEY");
    expect(error.metadata.status).toBe(401);
  });
});
