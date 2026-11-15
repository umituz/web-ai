import type {
  GenerationResult,
  ProviderHealth,
  StreamCallbacks,
  StructuredGeneration,
  StructuredTextRequest,
  TextRequest,
  TextTier,
  TokenUsage,
  ChatMessage,
} from "../../core/types";
import { AIError, AIErrorType } from "../../core/errors";
import { JsonResponseParser, StructuredPromptBuilder } from "../../core/parsers";
import { mergeTierOverrides, resolveModel, type TierModelMap } from "../../core/tiers";
import type { ITextProvider } from "../base/provider.types";
import { createOpenAiCompatibleAdapter } from "../adapters/openai-compatible.adapter";
import type {
  AdapterChatMessage,
  AdapterRequest,
  ChatAdapter,
} from "../adapters/adapter.types";
import type { OpenAiCompatibleProviderConfig } from "./openai-compatible.entities";

const DEFAULT_TIMEOUT_MS = 30_000;
const STRUCTURED_TEMPERATURE = 0.1;

/**
 * Generic OpenAI-compatible text provider — the factory-registered face of
 * the existing `createOpenAiCompatibleAdapter`. Speaks the wire every
 * OpenAI-shaped endpoint speaks, which makes it the one block an app needs
 * when its model access arrives through a gateway URL instead of a named
 * vendor key.
 */
export class OpenAiCompatibleProvider implements ITextProvider {
  readonly id = "openai-compatible";
  readonly name = "OpenAI-compatible";
  readonly capabilities = ["text"] as const;

  private readonly adapter: ChatAdapter;
  private readonly tiers: TierModelMap;
  private readonly jsonParser = new JsonResponseParser();

  constructor(readonly config: OpenAiCompatibleProviderConfig) {
    if (!config.baseUrl && !config.endpointUrl) {
      throw new AIError(
        AIErrorType.MISSING_CONFIG,
        "OpenAiCompatibleProvider requires baseUrl or endpointUrl",
      );
    }
    this.adapter = createOpenAiCompatibleAdapter({
      baseUrl: config.baseUrl,
      endpointUrl: config.endpointUrl,
      apiKey: config.apiKey,
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
    this.tiers = mergeTierOverrides(
      config.model ? { fast: config.model, balanced: config.model, powerful: config.model } : {},
      config.models,
    );
  }

  resolveModel(tier: TextTier): string {
    return resolveModel(this.tiers, tier, this.id);
  }

  async healthCheck(): Promise<ProviderHealth> {
    return this.config.apiKey && (this.config.baseUrl || this.config.endpointUrl)
      ? "healthy"
      : "unavailable";
  }

  async estimateCost(): Promise<number> {
    return 0;
  }

  async generate(request: TextRequest): Promise<GenerationResult> {
    const model = this.modelFor(request);
    const outcome = await this.consume(this.toAdapterRequest(model, request));
    if (outcome.text.length === 0) {
      throw this.noContentError(model);
    }
    return {
      text: outcome.text,
      usage: outcome.usage,
      model,
      providerId: this.id,
      finishReason: "stop",
    };
  }

  async generateStructured<T>(
    request: StructuredTextRequest,
  ): Promise<StructuredGeneration<T>> {
    const model = this.modelFor(request);

    const messages = this.toWireMessages(request.messages, request.systemPrompt);
    const lastUserIndex = findLastIndex(messages, (m) => m.role === "user");
    if (lastUserIndex === -1) {
      throw new AIError(
        AIErrorType.UNKNOWN_ERROR,
        "generateStructured requires at least one user message",
      );
    }

    const structuredPrompt = new StructuredPromptBuilder(
      messages[lastUserIndex]?.content ?? "",
    )
      .withSchema(request.schema)
      .build();
    messages[lastUserIndex] = { role: "user", content: structuredPrompt };

    const outcome = await this.consume({
      externalModelId: model,
      messages,
      temperature: STRUCTURED_TEMPERATURE,
      signal: request.signal,
    });
    if (outcome.text.length === 0) {
      throw this.noContentError(model);
    }

    return {
      value: this.jsonParser.parse<T>(outcome.text),
      result: {
        text: outcome.text,
        usage: outcome.usage,
        model,
        providerId: this.id,
        finishReason: "stop",
      },
    };
  }

  async stream(
    request: TextRequest,
    callbacks: StreamCallbacks,
  ): Promise<GenerationResult> {
    const model = this.modelFor(request);

    try {
      const outcome = await this.consume(this.toAdapterRequest(model, request), (text) => {
        callbacks.onChunk?.(text);
      });
      if (outcome.text.length === 0) {
        throw this.noContentError(model);
      }
      const result: GenerationResult = {
        text: outcome.text,
        usage: outcome.usage,
        model,
        providerId: this.id,
        finishReason: "stop",
      };
      callbacks.onComplete?.(result);
      return result;
    } catch (error) {
      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /* ---------- internals ---------- */

  /** Drain one adapter stream to its end. `onChunk`, when given, sees answer
   *  deltas as they arrive — the streaming surface is this same drain. */
  private async consume(
    req: AdapterRequest,
    onChunk?: (text: string) => void,
  ): Promise<{ readonly text: string; readonly usage?: TokenUsage }> {
    let text = "";
    let usage: TokenUsage | undefined;
    for await (const event of this.adapter.stream(req)) {
      if (event.type === "delta" && event.channel === "answer") {
        text += event.text;
        onChunk?.(event.text);
      } else if (event.type === "usage") {
        usage = event.usage;
      }
    }
    return { text, usage };
  }

  private modelFor(request: TextRequest): string {
    return request.model ?? this.resolveModel(request.tier ?? "balanced");
  }

  private noContentError(model: string): AIError {
    return new AIError(
      AIErrorType.SERVER_ERROR,
      "No content generated from the OpenAI-compatible endpoint",
      undefined,
      { model },
    );
  }

  private toAdapterRequest(model: string, request: TextRequest): AdapterRequest {
    return {
      externalModelId: model,
      messages: this.toWireMessages(request.messages, request.systemPrompt),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(request.maxTokens !== undefined ? { maxOutputTokens: request.maxTokens } : {}),
      ...(request.topP !== undefined ? { topP: request.topP } : {}),
      ...(request.signal ? { signal: request.signal } : {}),
    };
  }

  /** Neutral messages onto the adapter's shape; systemPrompt becomes the
   *  leading system message (in-band, the OpenAI way). */
  private toWireMessages(
    messages: ReadonlyArray<ChatMessage>,
    systemPrompt?: string,
  ): AdapterChatMessage[] {
    const wire: AdapterChatMessage[] = [];
    if (systemPrompt && systemPrompt.length > 0) {
      wire.push({ role: "system", content: systemPrompt });
    }
    for (const message of messages) {
      wire.push({ role: message.role, content: message.content });
    }
    return wire;
  }
}

export function createOpenAiCompatibleProvider(
  config: OpenAiCompatibleProviderConfig,
): OpenAiCompatibleProvider {
  return new OpenAiCompatibleProvider(config);
}

function findLastIndex<T>(
  items: ReadonlyArray<T>,
  predicate: (item: T) => boolean,
): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index] as T)) return index;
  }
  return -1;
}
