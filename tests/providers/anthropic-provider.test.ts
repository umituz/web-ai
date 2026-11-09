import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicProvider } from "../../src/providers/anthropic/anthropic.provider";
import { AnthropicRequestBuilder } from "../../src/providers/anthropic/anthropic-request.builder";
import { ANTHROPIC_MODELS } from "../../src/providers/anthropic/anthropic.constants";
import type { AnthropicMessagesResponse } from "../../src/providers/anthropic/anthropic.entities";

const messageResponse = (
  overrides: Partial<AnthropicMessagesResponse> = {},
): AnthropicMessagesResponse => ({
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: "claude-sonnet-5-5",
  content: [{ type: "text", text: "Hello there" }],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 5 },
  ...overrides,
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** RequestInit of the first captured fetch call — the wire assertion helper. */
const sentInit = (
  fetchMock: { mock: { calls: Array<[url: RequestInfo | URL, init?: RequestInit]> } },
): RequestInit => fetchMock.mock.calls[0]?.[1] ?? ({} as RequestInit);

describe("AnthropicProvider error mapping", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("authenticates with x-api-key + anthropic-version, never Bearer", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(messageResponse()),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new AnthropicProvider({ apiKey: "sk-ant-test" });
    await provider.generate({ messages: [{ role: "user", content: "hi" }] });

    const headers = new Headers(sentInit(fetchMock).headers);
    expect(headers.get("x-api-key")).toBe("sk-ant-test");
    expect(headers.get("anthropic-version")).toBe("2026-10-21");
    expect(headers.get("authorization")).toBeNull();
  });

  it("401 → INVALID_API_KEY with status metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, 401),
      ),
    );
    const provider = new AnthropicProvider({ apiKey: "bad" });
    const error = await provider
      .generate({ messages: [{ role: "user", content: "x" }] })
      .catch((e) => e);
    expect(error.type).toBe("INVALID_API_KEY");
    expect(error.metadata.status).toBe(401);
  });

  it("429 → RATE_LIMIT_ERROR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ type: "error", error: { type: "rate_limit_error", message: "slow down" } }, 429),
      ),
    );
    const provider = new AnthropicProvider({ apiKey: "k" });
    await expect(
      provider.generate({ messages: [{ role: "user", content: "x" }] }),
    ).rejects.toMatchObject({ type: "RATE_LIMIT_ERROR" });
  });

  it("5xx → SERVER_ERROR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ type: "error", error: { type: "api_error", message: "boom" } }, 503),
      ),
    );
    const provider = new AnthropicProvider({ apiKey: "k" });
    await expect(
      provider.generate({ messages: [{ role: "user", content: "x" }] }),
    ).rejects.toMatchObject({ type: "SERVER_ERROR" });
  });

  it("network TypeError → NETWORK_ERROR", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch: network error");
      }),
    );
    const provider = new AnthropicProvider({ apiKey: "k" });
    await expect(
      provider.generate({ messages: [{ role: "user", content: "x" }] }),
    ).rejects.toMatchObject({ type: "NETWORK_ERROR" });
  });
});

describe("AnthropicProvider generation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns usage-complete results with tier-resolved models", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(messageResponse()),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new AnthropicProvider({ apiKey: "sk-ant-test" });
    const result = await provider.generate({
      messages: [{ role: "user", content: "hi" }],
      tier: "powerful",
      maxTokens: 512,
    });

    expect(result.text).toBe("Hello there");
    expect(result.model).toBe("claude-sonnet-5-5");
    expect(result.providerId).toBe("anthropic");
    expect(result.finishReason).toBe("stop");
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 });

    const body = JSON.parse(sentInit(fetchMock).body as string);
    expect(body.model).toBe(ANTHROPIC_MODELS.OPUS_5_5);
    expect(body.max_tokens).toBe(512);
  });

  it("a refusal returns a flagged fallback line instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          messageResponse({
            content: [],
            stop_reason: "refusal",
            usage: { input_tokens: 8, output_tokens: 0 },
          }),
        ),
      ),
    );
    const provider = new AnthropicProvider({ apiKey: "sk-ant-test" });
    const result = await provider.generate({
      messages: [{ role: "user", content: "do something bad" }],
    });

    expect(result.finishReason).toBe("refusal");
    expect(result.text).toContain("not able to help");
    expect(result.usage?.inputTokens).toBe(8);
  });

  it("an empty non-refusal completion is a server error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(messageResponse({ content: [], stop_reason: "end_turn" })),
      ),
    );
    const provider = new AnthropicProvider({ apiKey: "sk-ant-test" });
    await expect(
      provider.generate({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toMatchObject({ type: "SERVER_ERROR" });
  });

  it("tier defaults: fast=haiku, balanced=sonnet, powerful=opus", () => {
    const provider = new AnthropicProvider({ apiKey: "k" });
    expect(provider.resolveModel("fast")).toBe(ANTHROPIC_MODELS.HAIKU_5_5);
    expect(provider.resolveModel("balanced")).toBe(ANTHROPIC_MODELS.SONNET_5_5);
    expect(provider.resolveModel("powerful")).toBe(ANTHROPIC_MODELS.OPUS_5_5);
  });

  it("healthCheck hits GET /v1/models and maps status", async () => {
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) =>
      init?.method === "GET" ? jsonResponse({ data: [] }) : jsonResponse(messageResponse()),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new AnthropicProvider({ apiKey: "k" });
    await expect(provider.healthCheck()).resolves.toBe("healthy");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/v1/models");
  });

  it("builds structured requests through the schema-wrapped prompt", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(
        messageResponse({
          content: [{ type: "text", text: '```json\n{"title":"T"}\n```' }],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new AnthropicProvider({ apiKey: "k" });
    const { value, result } = await provider.generateStructured<{ title: string }>({
      messages: [{ role: "user", content: "make a title" }],
      schema: { type: "object", properties: { title: { type: "string" } } },
    });

    expect(value).toEqual({ title: "T" });
    expect(result.usage?.inputTokens).toBe(10);

    const body = JSON.parse(sentInit(fetchMock).body as string);
    expect(body.messages.at(-1).content).toContain("Expected JSON schema");
  });
});

describe("AnthropicRequestBuilder (via provider path)", () => {
  it("system prompt travels top-level even in structured mode", () => {
    const request = new AnthropicRequestBuilder(ANTHROPIC_MODELS.HAIKU_5_5)
      .withRequest({
        messages: [{ role: "user", content: "q" }],
        systemPrompt: "sys",
      })
      .build();
    expect(request.system).toBe("sys");
    expect(request.messages).toHaveLength(1);
  });
});
