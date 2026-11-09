
import type {
  IChatService,
  SystemPromptStrategy,
} from "../interfaces";
import type {
  ChatMessage,
  ChatConfig,
  ChatConversation,
  SendMessageInput,
  SendMessageResult,
  IChatStorage,
  ChatTokenUsage,
} from "../entities";
import type { GenerationResult, StreamCallbacks, TextRequest } from "../../core/types";
import { AIError, AIErrorType } from "../../core/errors";
import type { ITextProvider } from "../../providers/base/provider.types";
import { ProviderFactory } from "../../providers/factory/provider.factory";
import { messageFormatter } from "../utils/message-formatter";
import { DEFAULT_PROMPT_STRATEGY } from "../utils/prompt-strategy";

const DEFAULT_CONFIG: ChatConfig = {
  temperature: 0.8,
  maxTokens: 500,
};

/**
 * Conversation engine over the neutral text surface. Accepts either a
 * single ITextProvider or a ProviderFactory (which brings tier defaults,
 * health checks, and fallback across providers). Model choice is tier-based:
 * `config.tier ?? provider default` — no hardcoded model names anywhere.
 */
export class ChatService implements IChatService {
  private config: ChatConfig = DEFAULT_CONFIG;
  private promptStrategy: SystemPromptStrategy = DEFAULT_PROMPT_STRATEGY;
  private storage: IChatStorage | null = null;

  constructor(
    private readonly engine: ITextProvider | ProviderFactory,
  ) {}

  initialize(config: ChatConfig): void {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  updateConfig(config: Partial<ChatConfig>): void {
    this.config = { ...this.config, ...config };
  }

  setPromptStrategy(strategy: SystemPromptStrategy): void {
    this.promptStrategy = strategy;
  }

  setStorage(storage: IChatStorage): void {
    this.storage = storage;
  }

  async getConversation(conversationId: string): Promise<ChatConversation | null> {
    const storage = this.requireStorage();
    const messages = await storage.getMessages(conversationId);
    if (messages.length === 0) return null;
    const last = messages[messages.length - 1];
    const first = messages[0];
    if (!last || !first) return null;
    const companionId = String(first.metadata?.["companionId"] ?? "unknown");
    const companionName = String(first.metadata?.["companionName"] ?? "Unknown");
    return {
      id: conversationId,
      companionId,
      companionName,
      lastMessage: last,
      messageCount: messages.length,
      updatedAt: last.timestamp,
    };
  }

  async getConversations(): Promise<ChatConversation[]> {
    if (
      this.storage &&
      "getConversations" in this.storage &&
      typeof (this.storage as unknown as { getConversations: () => Promise<ChatConversation[]> }).getConversations === "function"
    ) {
      return (this.storage as unknown as { getConversations: () => Promise<ChatConversation[]> }).getConversations();
    }
    return [];
  }

  async sendMessage(input: SendMessageInput, signal?: AbortSignal): Promise<SendMessageResult> {
    const userMessage: ChatMessage = {
      ...messageFormatter.toChatMessage(input.text, "user"),
      type: input.type ?? "text",
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
    };

    const aiResponse = await this.generateAIResponse(
      input.companionId,
      input.text,
      [],
      signal,
    );

    return { userMessage, aiResponse };
  }

  async generateAIResponse(
    companionId: string,
    userMessage: string,
    context: ReadonlyArray<ChatMessage> = [],
    signal?: AbortSignal,
  ): Promise<ChatMessage> {
    const result = await this.run({
      ...this.buildRequest(userMessage, context, signal),
    });

    return {
      ...messageFormatter.toChatMessage(result.text, "assistant"),
      metadata: {
        companionId,
        model: result.model,
        usage: {
          input_tokens: result.usage?.inputTokens,
          output_tokens: result.usage?.outputTokens,
          total_tokens: result.usage?.totalTokens,
        },
        finishReason: result.finishReason,
      },
    };
  }

  async generateStreamingResponse(
    userMessage: string,
    context: ReadonlyArray<ChatMessage>,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const request = this.buildRequest(userMessage, context, signal);
    const result = await this.runStream(request, { onChunk });
    return result.text;
  }

  private buildRequest(
    userMessage: string,
    context: ReadonlyArray<ChatMessage>,
    signal?: AbortSignal,
  ): TextRequest {
    const messages = messageFormatter.toCoreMessages(context);
    messages.push({ role: "user", content: userMessage });
    return {
      messages,
      systemPrompt: this.resolveSystemPrompt(),
      model: this.config.model,
      tier: this.config.tier,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      ...(signal !== undefined ? { signal } : {}),
    };
  }

  private resolveSystemPrompt(): string | undefined {
    const prompt = this.promptStrategy.resolve(this.config);
    return prompt && prompt.length > 0 ? prompt : undefined;
  }

  private async run(request: TextRequest): Promise<GenerationResult> {
    if (this.engine instanceof ProviderFactory) {
      return this.engine.chat(request);
    }
    return this.engine.generate(request);
  }

  private async runStream(
    request: TextRequest,
    callbacks: Pick<StreamCallbacks, "onChunk">,
  ): Promise<GenerationResult> {
    if (this.engine instanceof ProviderFactory) {
      return this.engine.chatStream(request, callbacks);
    }
    return this.engine.stream(request, callbacks);
  }

  private requireStorage(): IChatStorage {
    if (!this.storage) {
      throw new AIError(
        AIErrorType.MISSING_CONFIG,
        "ChatService.getConversation requires setStorage() to be called first.",
      );
    }
    return this.storage;
  }
}

export function extractTokenUsage(message: ChatMessage): ChatTokenUsage | null {
  const meta = message.metadata;
  if (!meta) return null;
  const usage = meta["usage"];
  if (!usage || typeof usage !== "object") return null;
  const u = usage as Record<string, unknown>;
  const inputTokens = readNumber(u, ["input_tokens", "prompt_tokens"]);
  const outputTokens = readNumber(u, ["output_tokens", "completion_tokens"]);
  const totalTokens = readNumber(u, ["total_tokens"]);
  if (inputTokens === null || outputTokens === null || totalTokens === null) {
    return null;
  }
  return {
    promptTokens: inputTokens,
    completionTokens: outputTokens,
    totalTokens,
  };
}

function readNumber(
  source: Record<string, unknown>,
  keys: ReadonlyArray<string>,
): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number") return value;
  }
  return null;
}
