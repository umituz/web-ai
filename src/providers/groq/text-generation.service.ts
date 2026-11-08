import type {
  TextGenerationOptions,
  StreamingCallbacks,
  StructuredGenerationOptions,
  IGroqChatService,
  IGroqHttpClient,
} from "./groq-interfaces";
import type { GroqMessage } from "./groq.entities";
import { GroqError, GroqErrorType } from "../../core/errors/groq-error";
import { DEFAULT_MODELS, GROQ_TIERS } from "./groq.constants";
import {
  CACHE_KEY_TYPE_COMPLETION,
  CACHE_KEY_TYPE_CHAT,
} from "../../core/constants/identifier.constants";
import { CacheManager } from "../../core/utils/cache-manager";
import { GroqChatRequestBuilder } from "./groq-request.builder";
import { StructuredPromptBuilder } from "../../core/parsers/structured-prompt.builder";
import { JsonResponseParser } from "../../core/parsers/json-response.parser";
import { StreamingResponseParser } from "../../core/parsers/streaming-response.parser";
import { extractContentFromSsePayload } from "./groq-sse";
import { createUserMessage } from "./groq-messages";
import type {
  CostEstimateRequest,
  ITextProvider,
  ProviderCapability,
} from "../base/provider.types";
import type {
  GenerationResult,
  ProviderHealth,
  StreamCallbacks,
  StructuredGeneration,
  StructuredTextRequest,
  TextRequest,
  TextTier,
} from "../../core/types";

const STRUCTURED_OUTPUT_TEMPERATURE = 0.1;

export class TextGenerationService implements IGroqChatService, ITextProvider {
  readonly id = "groq-text-generation";
  readonly name = "Groq Text Generation";
  readonly capabilities: ReadonlyArray<ProviderCapability> = ["text"];

  private readonly jsonParser = new JsonResponseParser();

  constructor(
    private readonly httpClient: IGroqHttpClient,
    private readonly cache: CacheManager = new CacheManager(),
    private readonly defaultModel: string = DEFAULT_MODELS.TEXT,
  ) {}

  generateCompletion(
    prompt: string,
    options: TextGenerationOptions = {},
  ): Promise<string> {
    const model = options.model ?? this.defaultModel;

    return this.executeWithCache(
      {
        type: CACHE_KEY_TYPE_COMPLETION,
        model,
        prompt,
        config: options.generationConfig,
      },
      async () => {
        const request = GroqChatRequestBuilder.for(model)
          .withMessages([createUserMessage(prompt)])
          .withConfig(options.generationConfig)
          .build();
        const response = await this.httpClient.postChatCompletion(request);
        return this.extractContent(response.choices[0]?.message?.content);
      },
    );
  }

  generateChatCompletion(
    messages: ReadonlyArray<GroqMessage>,
    options: TextGenerationOptions = {},
  ): Promise<string> {
    const model = options.model ?? this.defaultModel;

    return this.executeWithCache(
      {
        type: CACHE_KEY_TYPE_CHAT,
        model,
        messages: [...messages],
        config: options.generationConfig,
      },
      async () => {
        const request = GroqChatRequestBuilder.for(model)
          .withMessages(messages)
          .withConfig(options.generationConfig)
          .build();
        const response = await this.httpClient.postChatCompletion(request);
        return this.extractContent(response.choices[0]?.message?.content);
      },
    );
  }

  generateStructured<T>(
    prompt: string,
    options?: StructuredGenerationOptions,
  ): Promise<T>;
  generateStructured<T>(
    request: StructuredTextRequest,
  ): Promise<StructuredGeneration<T>>;
  generateStructured<T>(
    promptOrRequest: string | StructuredTextRequest,
    options?: StructuredGenerationOptions,
  ): Promise<T | StructuredGeneration<T>> {
    if (typeof promptOrRequest === "string") {
      const model = options?.model ?? this.defaultModel;
      const jsonPrompt = StructuredPromptBuilder.for(promptOrRequest)
        .withSchema(options?.schema)
        .build();

      const request = GroqChatRequestBuilder.for(model)
        .withMessages([createUserMessage(jsonPrompt)])
        .withConfig({
          ...options?.generationConfig,
          temperature: STRUCTURED_OUTPUT_TEMPERATURE,
        })
        .build();

      return this.httpClient.postChatCompletion(request).then((response) => {
        const content = this.extractContent(response.choices[0]?.message?.content);
        return this.jsonParser.parse<T>(content);
      });
    }

    // StructuredTextRequest branch for ITextProvider interface
    const req = promptOrRequest;
    const model = req.model ?? (req.tier ? this.resolveModel(req.tier) : this.defaultModel);
    const schemaObj = req.schema;

    const messages: GroqMessage[] = [];
    if (req.systemPrompt) {
      messages.push({ role: "system", content: req.systemPrompt });
    }
    for (const m of req.messages) {
      messages.push({ role: m.role, content: m.content });
    }

    const lastMsg = messages[messages.length - 1];
    if (lastMsg) {
      const structuredPrompt = StructuredPromptBuilder.for(lastMsg.content)
        .withSchema(schemaObj)
        .build();
      messages[messages.length - 1] = { ...lastMsg, content: structuredPrompt };
    }

    const groqReq = GroqChatRequestBuilder.for(model)
      .withMessages(messages)
      .withConfig({
        temperature: req.temperature ?? STRUCTURED_OUTPUT_TEMPERATURE,
        maxTokens: req.maxTokens,
      })
      .build();

    return this.httpClient.postChatCompletion(groqReq).then((response) => {
      const content = this.extractContent(response.choices[0]?.message?.content);
      const parsed = this.jsonParser.parse<T>(content);
      const genResult: GenerationResult = {
        text: content,
        model: response.model,
        providerId: this.id,
        finishReason: response.choices[0]?.finish_reason ?? "stop",
        usage: response.usage
          ? {
              inputTokens: response.usage.prompt_tokens,
              outputTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
      };
      return { value: parsed, result: genResult };
    });
  }

  streamCompletion(
    prompt: string,
    callbacks: StreamingCallbacks,
    options: TextGenerationOptions = {},
  ): Promise<string> {
    return this.streamChatCompletion([createUserMessage(prompt)], callbacks, options);
  }

  async streamChatCompletion(
    messages: ReadonlyArray<GroqMessage>,
    callbacks: StreamingCallbacks,
    options: TextGenerationOptions = {},
  ): Promise<string> {
    const model = options.model ?? this.defaultModel;
    const request = GroqChatRequestBuilder.for(model)
      .withMessages(messages)
      .withConfig(options.generationConfig)
      .withStream(true)
      .build();

    const parser = new StreamingResponseParser(
      {
        onChunk: (chunk) => callbacks.onChunk?.(chunk),
      },
      extractContentFromSsePayload,
    );

    try {
      const stream = await this.httpClient.streamChatCompletion(request, {
        signal: options.signal,
      });
      const fullText = await parser.parse(stream);
      callbacks.onComplete?.(fullText);
      return fullText;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      callbacks.onError?.(err);
      throw err;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  // --- ITextProvider implementation ---

  resolveModel(tier: TextTier): string {
    return GROQ_TIERS[tier] ?? this.defaultModel;
  }

  async generate(request: TextRequest): Promise<GenerationResult> {
    const messages: GroqMessage[] = [];
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }
    for (const m of request.messages) {
      messages.push({ role: m.role, content: m.content });
    }

    const model = request.model ?? (request.tier ? this.resolveModel(request.tier) : this.defaultModel);
    const groqReq = GroqChatRequestBuilder.for(model)
      .withMessages(messages)
      .withConfig({
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      })
      .build();

    const resp = await this.httpClient.postChatCompletion(groqReq);
    const content = resp.choices[0]?.message?.content ?? "";

    return {
      text: content,
      finishReason: resp.choices[0]?.finish_reason ?? "stop",
      model: resp.model,
      providerId: this.id,
      usage: resp.usage
        ? {
            inputTokens: resp.usage.prompt_tokens,
            outputTokens: resp.usage.completion_tokens,
            totalTokens: resp.usage.total_tokens,
          }
        : undefined,
    };
  }

  async stream(
    request: TextRequest,
    callbacks: StreamCallbacks,
  ): Promise<GenerationResult> {
    const messages: GroqMessage[] = [];
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }
    for (const m of request.messages) {
      messages.push({ role: m.role, content: m.content });
    }

    const model = request.model ?? (request.tier ? this.resolveModel(request.tier) : this.defaultModel);
    const text = await this.streamChatCompletion(
      messages,
      {
        onChunk: callbacks.onChunk,
        onError: callbacks.onError,
      },
      {
        model,
        signal: request.signal,
        generationConfig: {
          temperature: request.temperature,
          maxTokens: request.maxTokens,
        },
      },
    );

    const result: GenerationResult = {
      text,
      finishReason: "stop",
      model,
      providerId: this.id,
    };
    callbacks.onComplete?.(result);
    return result;
  }

  async countTokens(text: string): Promise<number> {
    return Math.max(1, Math.ceil(text.length / 4));
  }

  async estimateCost(_request: CostEstimateRequest): Promise<number> {
    return 0;
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      await this.generateCompletion("ping", {
        generationConfig: { maxTokens: 1 },
      });
      return "healthy";
    } catch {
      return "unavailable";
    }
  }

  private async executeWithCache(
    params: Record<string, unknown>,
    factory: () => Promise<string>,
  ): Promise<string> {
    const key = this.cache.generateKey(params);
    const cached = this.cache.get<string>(key);
    if (cached !== null) {
      return cached;
    }
    const result = await factory();
    this.cache.set(key, result);
    return result;
  }

  private extractContent(content: string | undefined): string {
    if (!content) {
      throw new GroqError(
        GroqErrorType.UNKNOWN_ERROR,
        "No content generated from Groq API",
      );
    }
    return content;
  }
}
