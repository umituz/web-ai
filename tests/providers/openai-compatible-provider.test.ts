import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleProvider } from "../../src/providers/openai-compatible/openai-compatible.provider";
import { createAI } from "../../src/providers/factory/create-ai";

/** SSE frames an OpenAI-compatible chat-completions stream emits. */
const sse = (events: object[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  const payload = events
    .map((event) => `data: ${JSON.stringify(event)}`)
    .concat("data: [DONE]")
    .join("\n\n");
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
};

const chunk = (content?: string, usage?: object): object => ({
  ...(content !== undefined ? { choices: [{ delta: { content } }] } : {}),
  ...(usage ? { usage } : {}),
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const CONFIG = {
  apiKey: "gw-test",
  endpointUrl: "https://gateway.example/v1/chat/completions",
  model: "test-model",
};

describe("OpenAiCompatibleProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires a URL at construction and a model source at resolution", () => {
    expect(() => new OpenAiCompatibleProvider({ apiKey: "k" })).toThrow(/baseUrl or endpointUrl/);
    // No model source: construction succeeds, model resolution fails lazily.
    const bare = new OpenAiCompatibleProvider({ apiKey: "k", endpointUrl: "https://x" });
    expect(() => bare.resolveModel("balanced")).toThrow(/no model configured/);
  });

  it("endpointUrl wins and the model config pins every tier", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(sse([chunk("ok")]), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiCompatibleProvider(CONFIG);
    expect(provider.id).toBe("openai-compatible");
    expect(provider.resolveModel("fast")).toBe("test-model");
    expect(provider.resolveModel("powerful")).toBe("test-model");
    expect(await provider.healthCheck()).toBe("healthy");

    await provider.generate({ messages: [{ role: "user", content: "hi" }] });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(CONFIG.endpointUrl);
  });

  it("aggregates a streamed answer into a GenerationResult with usage", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        sse([
          chunk("Hello"),
          chunk(" there"),
          chunk(undefined, { prompt_tokens: 3, completion_tokens: 5 }),
        ]),
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiCompatibleProvider(CONFIG);
    const result = await provider.generate({
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result.text).toBe("Hello there");
    expect(result.providerId).toBe("openai-compatible");
    expect(result.model).toBe("test-model");
    expect(result.usage).toEqual({ inputTokens: 3, outputTokens: 5 });
  });

  it("sends systemPrompt as the leading system message and omits unset sampling fields", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(sse([chunk("ok")]), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiCompatibleProvider(CONFIG);
    await provider.generate({
      systemPrompt: "You are terse.",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 128,
    });

    const body = JSON.parse((fetchMock.mock.calls[0]?.[1]?.body as string) ?? "{}");
    expect(body.messages).toEqual([
      { role: "system", content: "You are terse." },
      { role: "user", content: "hi" },
    ]);
    expect(body.model).toBe("test-model");
    expect(body.max_completion_tokens).toBe(128);
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("top_p");
  });

  it("streams deltas through the callbacks", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(sse([chunk("Hel"), chunk("lo")]), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiCompatibleProvider(CONFIG);
    const seen: string[] = [];
    let completed = "";
    const result = await provider.stream(
      { messages: [{ role: "user", content: "hi" }] },
      {
        onChunk: (text) => seen.push(text),
        onComplete: (final) => {
          completed = final.text;
        },
      },
    );

    expect(seen).toEqual(["Hel", "lo"]);
    expect(result.text).toBe("Hello");
    expect(completed).toBe("Hello");
  });

  it("reports onError and rethrows when the endpoint fails", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ error: { message: "bad key" } }, 401),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiCompatibleProvider(CONFIG);
    const onError = vi.fn();
    await expect(
      provider.stream({ messages: [{ role: "user", content: "hi" }] }, { onError }),
    ).rejects.toThrow(/bad key/);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("parses structured output from a fenced JSON answer", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(sse([chunk('```json\n{"title":"Hi","score":4}\n```')]), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiCompatibleProvider(CONFIG);
    const { value, result } = await provider.generateStructured<{ title: string; score: number }>({
      messages: [{ role: "user", content: "rate this" }],
      schema: { type: "object", properties: { title: { type: "string" } } },
    });

    expect(value).toEqual({ title: "Hi", score: 4 });
    expect(result.providerId).toBe("openai-compatible");
  });

  it("resolves tiers from a models map when no single model is pinned", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(sse([chunk("ok")]), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiCompatibleProvider({
      apiKey: "gw-test",
      baseUrl: "https://api.openai.com/v1",
      models: { fast: "gpt-4o-mini", powerful: "gpt-4o" },
    });
    await provider.generate({
      messages: [{ role: "user", content: "hi" }],
      tier: "powerful",
    });

    const body = JSON.parse((fetchMock.mock.calls[0]?.[1]?.body as string) ?? "{}");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/chat/completions");
    expect(body.model).toBe("gpt-4o");
  });

  it("registers through createAI and serves chat()", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(sse([chunk("via factory")]), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const ai = createAI({ openaiCompatible: CONFIG });
    const { text, providerId } = await ai.chat({
      messages: [{ role: "user", content: "hi" }],
    });

    expect(text).toBe("via factory");
    expect(providerId).toBe("openai-compatible");
  });
});
