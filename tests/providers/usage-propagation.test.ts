import { afterEach, describe, expect, it, vi } from "vitest";
import { createAI } from "../../src/providers/factory/create-ai";

/**
 * The ancestor packages both declared token usage in their types and then
 * dropped it on the floor inside the services. These tests pin the contract
 * the merge was meant to fix: usage survives every public surface.
 */

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const groqCompletion = (promptTokens: number, completionTokens: number) =>
  jsonResponse({
    id: "chatcmpl-u",
    object: "chat.completion",
    created: 1_700_000_000,
    model: "llama-3.3-70b-versatile",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "Answer" },
        finish_reason: "stop",
        logprobs: null,
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  });

const anthropicCompletion = (inputTokens: number, outputTokens: number) =>
  jsonResponse({
    id: "msg_u",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    content: [{ type: "text", text: "Answer" }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  });

describe("usage propagation through the factory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("groq usage reaches factory.chat's GenerationResult", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => groqCompletion(11, 7)));

    const ai = createAI({ groq: { apiKey: "gsk" } });
    const result = await ai.chat({ messages: [{ role: "user", content: "q" }] });

    expect(result.providerId).toBe("groq");
    expect(result.usage).toEqual({
      inputTokens: 11,
      outputTokens: 7,
      totalTokens: 18,
    });
  });

  it("anthropic usage reaches factory.chat's GenerationResult", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => anthropicCompletion(9, 4)));

    const ai = createAI({ anthropic: { apiKey: "sk-ant" } });
    const result = await ai.chat({ messages: [{ role: "user", content: "q" }] });

    expect(result.providerId).toBe("anthropic");
    expect(result.usage).toEqual({ inputTokens: 9, outputTokens: 4 });
  });

  it("usage lands on the chatStream result and in onComplete — groq reads it from the x_groq tail", async () => {
    const chunks = [
      `data: ${JSON.stringify({ id: "c1", model: "llama-3.3-70b-versatile", choices: [{ index: 0, delta: { content: "An" }, finish_reason: null }] })}\n\n`,
      `data: ${JSON.stringify({
        id: "c1",
        model: "llama-3.3-70b-versatile",
        choices: [{ index: 0, delta: { content: "swer" }, finish_reason: "stop" }],
        x_groq: { usage: { prompt_tokens: 6, completion_tokens: 3, total_tokens: 9 } },
      })}\n\n`,
      "data: [DONE]\n\n",
    ];
    const encoder = new TextEncoder();
    let index = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (index >= chunks.length) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(chunks[index]));
        index += 1;
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(stream)));

    const ai = createAI({ groq: { apiKey: "gsk" } });
    const seen: unknown[] = [];
    const result = await ai.chatStream(
      { messages: [{ role: "user", content: "q" }] },
      {
        onChunk: () => undefined,
        onComplete: (completed) => seen.push(completed.usage),
      },
    );

    expect(result.text).toBe("Answer");
    expect(result.usage).toEqual({ inputTokens: 6, outputTokens: 3, totalTokens: 9 });
    expect(seen).toEqual([{ inputTokens: 6, outputTokens: 3, totalTokens: 9 }]);
  });

  it("generateText stays the string facade — usage lives on chat(), the surface content services don't use", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => anthropicCompletion(15, 2)));

    const ai = createAI({ anthropic: { apiKey: "sk-ant" } });
    await expect(ai.generateText("hello")).resolves.toBe("Answer");
  });

  it("usage rides along when fallback hands off from a failing provider", async () => {
    const fetchMock = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes("anthropic")) {
        return jsonResponse({ type: "error", error: { type: "api_error", message: "down" } }, 500);
      }
      return groqCompletion(21, 5);
    });
    vi.stubGlobal("fetch", fetchMock);

    const ai = createAI({
      priority: ["anthropic", "groq"],
      anthropic: { apiKey: "sk-ant" },
      groq: { apiKey: "gsk" },
    });
    const result = await ai.chat({ messages: [{ role: "user", content: "q" }] });

    expect(result.providerId).toBe("groq");
    expect(result.usage?.totalTokens).toBe(26);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
