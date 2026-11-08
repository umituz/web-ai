import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiProvider } from "../../src/providers/gemini/gemini.provider";
import { AIErrorType } from "../../src/core/errors";

describe("GeminiProvider", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const validConfig = {
    apiKey: "test-gemini-key",
    enabled: true,
  };

  it("resolves default tiers to Gemini models", () => {
    const provider = new GeminiProvider(validConfig);
    expect(provider.resolveModel("fast")).toBe("gemini-2.0-flash-lite");
    expect(provider.resolveModel("balanced")).toBe("gemini-2.0-flash");
    expect(provider.resolveModel("powerful")).toBe("gemini-2.5-pro");
  });

  it("generates text and maps usage", async () => {
    const provider = new GeminiProvider(validConfig);

    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: "Gemini response text" }] },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 12,
            candidatesTokenCount: 18,
            totalTokenCount: 30,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const result = await provider.generate({
      messages: [{ role: "user", content: "Hi" }],
      systemPrompt: "Be concise.",
    });

    expect(result.text).toBe("Gemini response text");
    expect(result.providerId).toBe("gemini");
    expect(result.finishReason).toBe("stop");
    expect(result.usage).toEqual({
      inputTokens: 12,
      outputTokens: 18,
      totalTokens: 30,
    });
  });

  it("extracts system prompt from messages when top-level systemPrompt is omitted", async () => {
    const provider = new GeminiProvider(validConfig);
    let capturedBody: Record<string, unknown> | undefined;

    globalThis.fetch = vi.fn(async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: "Acknowledged." }] },
              finishReason: "STOP",
            },
          ],
        }),
        { status: 200 },
      );
    });

    await provider.generate({
      messages: [
        { role: "system", content: "You are a math tutor." },
        { role: "user", content: "What is 2+2?" },
      ],
    });

    expect(capturedBody?.systemInstruction).toEqual({
      parts: [{ text: "You are a math tutor." }],
    });
    expect(capturedBody?.contents).toEqual([
      { role: "user", parts: [{ text: "What is 2+2?" }] },
    ]);
  });

  it("classifies HTTP 401 as INVALID_API_KEY", async () => {
    const provider = new GeminiProvider(validConfig);

    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { message: "API key not valid." } }),
        { status: 401, statusText: "Unauthorized" },
      );
    });

    await expect(
      provider.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toMatchObject({
      type: AIErrorType.INVALID_API_KEY,
    });
  });

  it("classifies HTTP 429 as RATE_LIMIT_ERROR", async () => {
    const provider = new GeminiProvider({ ...validConfig, retryAttempts: 1 });

    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { message: "Resource exhausted" } }),
        { status: 429, statusText: "Too Many Requests" },
      );
    });

    await expect(
      provider.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toMatchObject({
      type: AIErrorType.RATE_LIMIT_ERROR,
    });
  });

  it("reports health based on models endpoint status", async () => {
    const provider = new GeminiProvider(validConfig);

    globalThis.fetch = vi.fn(async () => new Response("ok", { status: 200 }));
    expect(await provider.healthCheck()).toBe("healthy");

    globalThis.fetch = vi.fn(async () => new Response("unauthorized", { status: 401 }));
    expect(await provider.healthCheck()).toBe("unavailable");

    globalThis.fetch = vi.fn(async () => new Response("server error", { status: 503 }));
    expect(await provider.healthCheck()).toBe("degraded");
  });

  it("generates inline base64 image", async () => {
    const provider = new GeminiProvider(validConfig);

    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: "iVBORw0KGgoAAAANSUhEUg==",
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    });

    const content = await provider.generateImage({
      type: "image",
      prompt: "A beautiful mountain",
    });

    expect(content.type).toBe("image");
    expect(content.url).toBe("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==");
    expect(content.metadata?.provider).toBe("gemini");
  });
});
