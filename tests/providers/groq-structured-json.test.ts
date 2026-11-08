import { describe, expect, it } from "vitest";
import { requestStructuredJson } from "../../src/providers/groq/groq-structured-json";
import { GroqError } from "../../src/core/errors/groq-error";
import type { GroqChatRequest, GroqChatResponse } from "../../src/providers/groq/groq.entities";
import type { IGroqHttpClient } from "../../src/providers/groq/groq-interfaces";

function clientReturning(content: string): {
  client: IGroqHttpClient;
  requests: GroqChatRequest[];
} {
  const requests: GroqChatRequest[] = [];
  const client = {
    postChatCompletion: async (request: GroqChatRequest): Promise<GroqChatResponse> => {
      requests.push(request);
      return {
        id: "resp_1",
        object: "chat.completion",
        created: 0,
        model: request.model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content },
            finish_reason: "stop",
            logprobs: null,
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };
    },
    streamChatCompletion: async () => {
      throw new Error("not implemented in test");
    },
    getApiKey: () => "test-key",
    setApiKey: () => undefined,
    initialize: () => undefined,
    isInitialized: () => true,
    cancelPendingRequests: () => undefined,
    reset: () => undefined,
  };
  return { client, requests };
}

describe("requestStructuredJson", () => {
  it("parses a bare json object and sends json_object response_format", async () => {
    const { client, requests } = clientReturning('{"score":42}');
    const value = await requestStructuredJson(client, {
      model: "test-model",
      instructions: "reply with json",
      maxTokens: 500,
      temperature: 0.1,
    });
    expect(value).toEqual({ score: 42 });
    expect(requests[0]?.response_format).toEqual({ type: "json_object" });
    expect(requests[0]?.max_tokens).toBe(500);
    expect(requests[0]?.messages).toHaveLength(1);
  });

  it("parses a code-fenced json object", async () => {
    const { client } = clientReturning('```json\n{"items":["a"]}\n```');
    const value = await requestStructuredJson(client, {
      model: "test-model",
      instructions: "reply with json",
      maxTokens: 500,
      temperature: 0.1,
    });
    expect(value).toEqual({ items: ["a"] });
  });

  it("throws GroqError when the payload has no parsable json", async () => {
    const { client } = clientReturning("no json at all");
    await expect(
      requestStructuredJson(client, {
        model: "test-model",
        instructions: "reply with json",
        maxTokens: 500,
        temperature: 0.1,
      }),
    ).rejects.toBeInstanceOf(GroqError);
  });

  it("throws GroqError on empty content", async () => {
    const { client } = clientReturning("");
    await expect(
      requestStructuredJson(client, {
        model: "test-model",
        instructions: "reply with json",
        maxTokens: 500,
        temperature: 0.1,
      }),
    ).rejects.toBeInstanceOf(GroqError);
  });
});
