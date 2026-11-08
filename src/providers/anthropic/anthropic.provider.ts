
import type {
  GenerationResult,
  ProviderHealth,
  StreamCallbacks,
  StructuredGeneration,
  StructuredTextRequest,
  TextRequest,
  TextTier,
} from "../../core/types";
import { AIError, AIErrorType } from "../../core/errors";
import { JsonResponseParser, StructuredPromptBuilder } from "../../core/parsers";
import { mergeTierOverrides, resolveModel, type TierModelMap } from "../../core/tiers";
import type { ITextProvider } from "../base/provider.types";
import { AnthropicHttpTransport } from "./anthropic-http.transport";
import { AnthropicRequestBuilder } from "./anthropic-request.builder";
import { consumeAnthropicStream, mapAnthropicStopReason } from "./anthropic-stream.parser";
import { ANTHROPIC_TIERS } from "./anthropic.constants";
import type {
  AnthropicContentBlock,
  AnthropicMessagesResponse,
  AnthropicProviderConfig,
  AnthropicUsage,
} from "./anthropic.entities";

/**
 * Graceful stand-in when the model refuses: surfaced as a flagged
 * GenerationResult rather than an exception, so chat UIs can render it.
 */
const REFUSAL_FALLBACK_TEXT =
  "I'm not able to help with that request. Could you rephrase or ask something else?";

/**
 * Anthropic provider over raw fetch — no SDK dependency, Workers-safe.
 * Implements the neutral ITextProvider surface with tier-based model
 * resolution and full token-usage propagation.
 */
export class AnthropicProvider implements ITextProvider {
  readonly id = "anthropic";
  readonly name = "Anthropic";
  readonly capabilities = ["text"] as const;

  private readonly transport: AnthropicHttpTransport;
  private readonly tiers: TierModelMap;
  private readonly jsonParser = new JsonResponseParser();

  constructor(readonly config: AnthropicProviderConfig) {
    this.transport = new AnthropicHttpTransport(config);
    this.tiers = mergeTierOverrides(ANTHROPIC_TIERS, config.models);
  }

  resolveModel(tier: TextTier): string {
    return resolveModel(this.tiers, tier, this.id);
  }

  async healthCheck(): Promise<ProviderHealth> {
    if (!this.config.apiKey) return "unavailable";
    try {
      const response = await this.transport.listModels();
      if (response.ok) return "healthy";
      if (response.status === 401 || response.status === 403) return "unavailable";
      return "degraded";
    } catch {
      return "unavailable";
    }
  }

  async estimateCost(): Promise<number> {
    return 0;
  }

  async generate(request: TextRequest): Promise<GenerationResult> {
    const model = request.model ?? this.resolveModel(request.tier ?? "balanced");
    const wireRequest = new AnthropicRequestBuilder(model)
      .withRequest(request)
      .withEffort(this.config.effort)
      .build();

    const response = await this.transport.postMessages(wireRequest, {
      signal: request.signal,
    });

    return this.toGenerationResult(response, model);
  }

  async generateStructured<T>(
    request: StructuredTextRequest,
  ): Promise<StructuredGeneration<T>> {
    const model = request.model ?? this.resolveModel(request.tier ?? "balanced");

    const messages = [...request.messages];
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

    const wireRequest = new AnthropicRequestBuilder(model)
      .withRequest({ ...request, messages })
      .withEffort(this.config.effort)
      .build();

    const response = await this.transport.postMessages(wireRequest, {
      signal: request.signal,
    });

    const result = this.toGenerationResult(response, model);
    return { value: this.jsonParser.parse<T>(result.text), result };
  }

  async stream(
    request: TextRequest,
    callbacks: StreamCallbacks,
  ): Promise<GenerationResult> {
    const model = request.model ?? this.resolveModel(request.tier ?? "balanced");
    const wireRequest = new AnthropicRequestBuilder(model)
      .withRequest(request)
      .withEffort(this.config.effort)
      .withStream(true)
      .build();

    const streamBody = await this.transport.streamMessages(wireRequest, {
      signal: request.signal,
    });

    try {
      const outcome = await consumeAnthropicStream(streamBody, callbacks);
      const text =
        outcome.text.length > 0 ? outcome.text : refusalTextFor(outcome.finishReason);
      const result: GenerationResult = {
        text,
        usage: {
          inputTokens: outcome.inputTokens ?? 0,
          outputTokens: outcome.outputTokens ?? 0,
        },
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

  private toGenerationResult(
    response: AnthropicMessagesResponse,
    fallbackModel: string,
  ): GenerationResult {
    const text = extractText(response.content);
    const finishReason = mapAnthropicStopReason(response.stop_reason);

    if (text.length === 0) {
      // A refusal arrives as an empty completion with stop_reason
      // 'refusal' — return a flagged fallback line instead of throwing,
      // per API guidance. Any other empty completion is a server fault.
      if (finishReason === "refusal") {
        return {
          text: REFUSAL_FALLBACK_TEXT,
          usage: mapAnthropicUsage(response.usage),
          model: response.model || fallbackModel,
          providerId: this.id,
          finishReason,
        };
      }
      throw new AIError(
        AIErrorType.SERVER_ERROR,
        "No content generated from Anthropic API",
        undefined,
        { model: response.model || fallbackModel, stopReason: response.stop_reason ?? undefined },
      );
    }

    return {
      text,
      usage: mapAnthropicUsage(response.usage),
      model: response.model || fallbackModel,
      providerId: this.id,
      finishReason,
    };
  }
}

function extractText(blocks: ReadonlyArray<AnthropicContentBlock>): string {
  return blocks
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

function refusalTextFor(finishReason: string | undefined): string {
  return finishReason === "refusal" ? REFUSAL_FALLBACK_TEXT : "";
}

function mapAnthropicUsage(usage: AnthropicUsage | undefined) {
  if (!usage) return undefined;
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
  };
}

function findLastIndex<T>(items: ReadonlyArray<T>, predicate: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i--) {
    if (predicate(items[i])) return i;
  }
  return -1;
}
