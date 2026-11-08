
import type {
  GenerationResult,
  ProviderHealth,
  StreamCallbacks,
  StructuredGeneration,
  StructuredTextRequest,
  TextRequest,
  TextTier,
  ChatMessage,
} from "../../core/types";
import { AIError, AIErrorType } from "../../core/errors";
import { CacheManager } from "../../core/utils";
import { JsonResponseParser, StructuredPromptBuilder } from "../../core/parsers";
import { mergeTierOverrides, resolveModel, type TierModelMap } from "../../core/tiers";
import type { ITextProvider } from "../base/provider.types";
import { GroqChatRequestBuilder } from "./groq-request.builder";
import { GroqHttpClient } from "./groq-http-client";
import { GROQ_TIERS } from "./groq.constants";
import {
  consumeGroqStream,
  mapGroqFinishReason,
  mapGroqUsage,
} from "./groq-sse";
import type {
  GroqChatRequest,
  GroqGenerationConfig,
  GroqMessage,
  GroqProviderConfig,
} from "./groq.entities";

/** Cache key layout version — bumped when the cached value shape changes. */
const CACHE_LAYOUT_VERSION = 2;
const STRUCTURED_TEMPERATURE = 0.1;

/**
 * Groq provider over the ported machinery (dedupe/retry/queue pipeline,
 * LRU+TTL response cache). Implements the neutral ITextProvider surface:
 * tier-based model resolution, GenerationResult with token usage, and
 * callback-based streaming.
 */
export class GroqProvider implements ITextProvider {
  readonly id = "groq";
  readonly name = "Groq";
  readonly capabilities = ["text"] as const;

  private readonly client: GroqHttpClient;
  private readonly tiers: TierModelMap;
  private readonly cache = new CacheManager();
  private readonly jsonParser = new JsonResponseParser();

  constructor(readonly config: GroqProviderConfig) {
    this.client = new GroqHttpClient(config);
    this.tiers = mergeTierOverrides(GROQ_TIERS, config.models);
  }

  resolveModel(tier: TextTier): string {
    return resolveModel(this.tiers, tier, this.id);
  }

  async healthCheck(): Promise<ProviderHealth> {
    return this.config.apiKey ? "healthy" : "unavailable";
  }

  async estimateCost(): Promise<number> {
    return 0;
  }

  async generate(request: TextRequest): Promise<GenerationResult> {
    const model = request.model ?? this.resolveModel(request.tier ?? "balanced");
    const cacheKey = this.cache.generateKey({
      v: CACHE_LAYOUT_VERSION,
      provider: this.id,
      op: "generate",
      model,
      messages: request.messages,
      systemPrompt: request.systemPrompt ?? null,
      temperature: request.temperature ?? null,
      maxTokens: request.maxTokens ?? null,
      topP: request.topP ?? null,
    });

    const cached = this.cache.get<GenerationResult>(cacheKey);
    if (cached) return cached;

    const response = await this.client.postChatCompletion(
      this.buildWireRequest(model, request),
    );

    const choice = response.choices?.[0];
    const text = choice?.message?.content ?? "";
    if (text.length === 0) {
      throw new AIError(
        AIErrorType.SERVER_ERROR,
        "No content generated from Groq API",
        undefined,
        { model },
      );
    }

    const result: GenerationResult = {
      text,
      usage: mapGroqUsage(response.usage),
      model: response.model || model,
      providerId: this.id,
      finishReason: mapGroqFinishReason(choice?.finish_reason),
    };
    this.cache.set(cacheKey, result);
    return result;
  }

  async generateStructured<T>(
    request: StructuredTextRequest,
  ): Promise<StructuredGeneration<T>> {
    const model = request.model ?? this.resolveModel(request.tier ?? "balanced");

    const messages = toGroqMessages(request.messages, request.systemPrompt);
    const lastUserIndex = findLastIndex(messages, (m) => m.role === "user");
    if (lastUserIndex === -1) {
      throw new AIError(
        AIErrorType.UNKNOWN_ERROR,
        "generateStructured requires at least one user message",
      );
    }

    const structuredPrompt = new StructuredPromptBuilder(
      messages[lastUserIndex].content,
    )
      .withSchema(request.schema)
      .build();
    messages[lastUserIndex] = { role: "user", content: structuredPrompt };

    const wireRequest = GroqChatRequestBuilder.for(model)
      .withMessages(messages)
      .withConfig(this.generationConfig(request, STRUCTURED_TEMPERATURE))
      .withJsonResponse(true)
      .build();

    const response = await this.client.postChatCompletion(wireRequest);
    const choice = response.choices?.[0];
    const text = choice?.message?.content ?? "";
    if (text.length === 0) {
      throw new AIError(
        AIErrorType.SERVER_ERROR,
        "No content generated from Groq API",
        undefined,
        { model },
      );
    }

    return {
      value: this.jsonParser.parse<T>(text),
      result: {
        text,
        usage: mapGroqUsage(response.usage),
        model: response.model || model,
        providerId: this.id,
        finishReason: mapGroqFinishReason(choice?.finish_reason),
      },
    };
  }

  async stream(
    request: TextRequest,
    callbacks: StreamCallbacks,
  ): Promise<GenerationResult> {
    const model = request.model ?? this.resolveModel(request.tier ?? "balanced");
    const streamBody = await this.client.streamChatCompletion(
      this.buildWireRequest(model, request),
      { signal: request.signal },
    );

    try {
      const outcome = await consumeGroqStream(streamBody, callbacks);
      if (outcome.text.length === 0) {
        throw new AIError(
          AIErrorType.SERVER_ERROR,
          "No content generated from Groq API",
          undefined,
          { model },
        );
      }
      const result: GenerationResult = {
        text: outcome.text,
        usage: outcome.usage,
        model: outcome.model ?? model,
        providerId: this.id,
        finishReason: outcome.finishReason,
      };
      callbacks.onComplete?.(result);
      return result;
    } catch (error) {
      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  clearCache() {
    this.cache.clear();
  }

  cancelPendingRequests() {
    this.client.cancelPendingRequests();
  }

  private buildWireRequest(model: string, request: TextRequest): GroqChatRequest {
    return GroqChatRequestBuilder.for(model)
      .withMessages(toGroqMessages(request.messages, request.systemPrompt))
      .withConfig(this.generationConfig(request))
      .build();
  }

  private generationConfig(
    request: TextRequest,
    temperatureOverride?: number,
  ): GroqGenerationConfig {
    return {
      ...(request.temperature !== undefined
        ? { temperature: request.temperature }
        : {}),
      ...(temperatureOverride !== undefined
        ? { temperature: temperatureOverride }
        : {}),
      ...(request.maxTokens !== undefined ? { maxTokens: request.maxTokens } : {}),
      ...(request.topP !== undefined ? { topP: request.topP } : {}),
      ...(request.stopSequences !== undefined && request.stopSequences.length > 0
        ? { stop: [...request.stopSequences] }
        : {}),
    };
  }
}

/** Maps neutral messages to Groq's wire format; systemPrompt becomes the leading system message. */
export function toGroqMessages(
  messages: ReadonlyArray<ChatMessage>,
  systemPrompt?: string,
): GroqMessage[] {
  const wire: GroqMessage[] = [];
  if (systemPrompt && systemPrompt.length > 0) {
    wire.push({ role: "system", content: systemPrompt });
  }
  for (const message of messages) {
    if (message.role === "system") {
      wire.push({ role: "system", content: message.content });
      continue;
    }
    wire.push({ role: message.role, content: message.content });
  }
  return wire;
}

function findLastIndex<T>(items: ReadonlyArray<T>, predicate: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i--) {
    if (predicate(items[i])) return i;
  }
  return -1;
}
