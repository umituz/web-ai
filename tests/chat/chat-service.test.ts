import { describe, expect, it, vi } from "vitest";
import { ChatService, extractTokenUsage } from "../../src/chat";
import type { ITextProvider } from "../../src/providers";
import type { ChatConversation, ChatMessage, IChatStorage } from "../../src/chat";

function createMockTextProvider(text = "Hello from AI"): ITextProvider {
  return {
    id: "mock",
    name: "Mock Provider",
    capabilities: ["text"],
    healthCheck: async () => "healthy",
    estimateCost: async () => 0,
    resolveModel: () => "mock-model",
    generate: vi.fn(async () => ({
      text,
      model: "mock-model",
      providerId: "mock",
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      finishReason: "stop" as const,
    })),
    generateStructured: vi.fn(),
    stream: vi.fn(async (_req, callbacks) => {
      callbacks.onChunk?.(text);
      const result = {
        text,
        model: "mock-model",
        providerId: "mock",
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        finishReason: "stop" as const,
      };
      callbacks.onComplete?.(result);
      return result;
    }),
  };
}

describe("ChatService", () => {
  it("initializes and updates configuration", () => {
    const provider = createMockTextProvider();
    const service = new ChatService(provider);

    service.initialize({ temperature: 0.5, maxTokens: 1000 });
    service.updateConfig({ temperature: 0.2 });

    expect(service).toBeDefined();
  });

  it("sends a message and receives an AI response", async () => {
    const provider = createMockTextProvider("I can help with that.");
    const service = new ChatService(provider);

    const result = await service.sendMessage({
      companionId: "c1",
      text: "Can you help?",
    });

    expect(result.userMessage.content).toBe("Can you help?");
    expect(result.userMessage.sender).toBe("user");
    expect(result.aiResponse).toBeDefined();
    expect(result.aiResponse?.content).toBe("I can help with that.");
    expect(result.aiResponse?.sender).toBe("assistant");
    expect(result.aiResponse?.metadata?.["model"]).toBe("mock-model");
  });

  it("propagates signal to provider on generateAIResponse", async () => {
    const provider = createMockTextProvider();
    const service = new ChatService(provider);
    const controller = new AbortController();

    await service.generateAIResponse("c1", "Hello", [], controller.signal);

    expect(provider.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: controller.signal,
      }),
    );
  });

  it("propagates signal to provider on generateStreamingResponse", async () => {
    const provider = createMockTextProvider("streamed chunk");
    const service = new ChatService(provider);
    const controller = new AbortController();
    const chunks: string[] = [];

    const fullText = await service.generateStreamingResponse(
      "Hello stream",
      [],
      (chunk) => chunks.push(chunk),
      controller.signal,
    );

    expect(fullText).toBe("streamed chunk");
    expect(chunks).toEqual(["streamed chunk"]);
    expect(provider.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: controller.signal,
      }),
      expect.any(Object),
    );
  });

  it("delegates getConversations to storage if implemented", async () => {
    const provider = createMockTextProvider();
    const service = new ChatService(provider);

    expect(await service.getConversations()).toEqual([]);

    const mockStorage: IChatStorage & { getConversations: () => Promise<ChatConversation[]> } = {
      saveMessage: vi.fn(),
      getMessages: vi.fn(),
      updateMessage: vi.fn(),
      deleteMessage: vi.fn(),
      getConversations: vi.fn(async () => [
        {
          id: "conv-1",
          companionId: "c1",
          companionName: "Companion 1",
          messageCount: 5,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
    };

    service.setStorage(mockStorage);
    const convs = await service.getConversations();
    expect(convs).toHaveLength(1);
    expect(convs[0]?.id).toBe("conv-1");
  });

  it("extracts token usage correctly from assistant message metadata", () => {
    const message: ChatMessage = {
      id: "msg-1",
      sender: "assistant",
      content: "Hello",
      timestamp: new Date().toISOString(),
      metadata: {
        usage: {
          input_tokens: 15,
          output_tokens: 25,
          total_tokens: 40,
        },
      },
    };

    const usage = extractTokenUsage(message);
    expect(usage).toEqual({
      promptTokens: 15,
      completionTokens: 25,
      totalTokens: 40,
    });

    const noUsageMessage: ChatMessage = {
      id: "msg-2",
      sender: "user",
      content: "Hi",
      timestamp: new Date().toISOString(),
    };
    expect(extractTokenUsage(noUsageMessage)).toBeNull();
  });
});
