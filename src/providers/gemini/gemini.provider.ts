
import { BaseProvider } from '../base/base.provider';
import type { GeneratedContent } from '../../content/domain/config/ProviderConfig';
import type {
  GenerationResult,
  ProviderHealth,
  StreamCallbacks,
  StructuredGeneration,
  StructuredTextRequest,
  TextRequest,
  TextTier,
  ChatMessage,
} from '../../core/types';
import {
  AIError,
  AIErrorType,
  classifyHttpStatus,
  extractErrorMessageFromResponse,
} from '../../core/errors';
import { JsonResponseParser, StructuredPromptBuilder } from '../../core/parsers';
import { mergeTierOverrides, resolveModel, type TierModelMap } from '../../core/tiers';
import type {
  CostEstimateRequest,
  IMediaProvider,
  ITextProvider,
} from '../base/provider.types';
import { ProviderTimingConfig } from '../../content/domain/limits/ProviderTimingConfig';
import { estimateGeminiGenerationCost } from '../../content/domain/predicates/ProviderCostEstimator';
import { ModelDefaults } from '../../content/domain/limits/ModelDefaults';
import type {
  GeminiConfig,
  ImageGenerationRequest,
  ImageToVideoRequest,
  VideoGenerationRequest,
  VideoToVideoRequest,
} from '../../content/domain/config/ProviderConfig';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text?: string;
        inlineData?: {
          data: string;
          mimeType: string;
        };
      }>;
    };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export const GEMINI_TIERS: TierModelMap = {
  fast: 'gemini-2.0-flash-lite',
  balanced: ModelDefaults.GEMINI_TEXT,
  powerful: 'gemini-2.5-pro',
};

/**
 * Gemini provider — text via generateContent (multi-turn aware, system
 * instruction in the proper slot) plus inline image generation. Video is not
 * supported by this surface and throws with a clear message.
 */
export class GeminiProvider extends BaseProvider implements ITextProvider, IMediaProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';
  readonly capabilities = ['text', 'image'] as const;

  private models: { text: string; image: string; video?: string };
  private readonly tiers: TierModelMap;
  private readonly jsonParser = new JsonResponseParser();

  constructor(config: GeminiConfig) {
    super({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
      timeout: config.timeout || ProviderTimingConfig.GEMINI_TIMEOUT_MS,
      retryAttempts: config.retryAttempts || ProviderTimingConfig.GEMINI_RETRY_ATTEMPTS,
    });

    this.models = {
      text: ModelDefaults.GEMINI_TEXT,
      image: ModelDefaults.GEMINI_IMAGE,
    };
    if (config.models) {
      this.models = { ...this.models, ...config.models };
    }
    this.tiers = mergeTierOverrides(
      GEMINI_TIERS,
      config.models ? { balanced: config.models.text } : undefined,
    );
  }

  resolveModel(tier: TextTier): string {
    return resolveModel(this.tiers, tier, this.id);
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      if (!this.config.apiKey) {
        return 'unavailable';
      }

      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/models`,
        {
          method: 'GET',
          headers: this.authHeaders(),
        }
      );

      if (response.ok) return 'healthy';
      if (response.status === 401 || response.status === 403) return 'unavailable';
      return 'degraded';
    } catch {
      return 'unavailable';
    }
  }

  async estimateCost(request: CostEstimateRequest): Promise<number> {
    return estimateGeminiGenerationCost(request as Parameters<typeof estimateGeminiGenerationCost>[0]);
  }

  async generate(request: TextRequest): Promise<GenerationResult> {
    try {
      const model = request.model ?? this.resolveModel(request.tier ?? 'balanced');
      const systemMessages = request.messages.filter((m) => m.role === 'system');
      const systemPrompt =
        request.systemPrompt && request.systemPrompt.length > 0
          ? request.systemPrompt
          : systemMessages.length > 0
            ? systemMessages.map((m) => m.content).join('\n')
            : undefined;

      const response = await this.withRetry(async () => {
        return await this.fetchWithTimeout(
          `${this.config.baseUrl}/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: this.authHeaders(),
            body: JSON.stringify({
              systemInstruction:
                systemPrompt && systemPrompt.length > 0
                  ? { parts: [{ text: systemPrompt }] }
                  : undefined,
              contents: toGeminiContents(request.messages),
              generationConfig: {
                temperature: request.temperature ?? 0.7,
                maxOutputTokens: request.maxTokens ?? 2048,
                topP: request.topP ?? 0.9,
              },
            }),
          }
        );
      });

      if (!response.ok) {
        const message = await extractErrorMessageFromResponse(response);
        throw new AIError(
          classifyHttpStatus(response.status),
          `Gemini API error (${response.status}): ${message}`,
          undefined,
          { status: response.status, model },
        );
      }

      const data: GeminiResponse = await response.json();
      const text = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('') ?? '';
      if (text.length === 0) {
        throw new AIError(AIErrorType.SERVER_ERROR, 'No content generated from Gemini API', undefined, { model });
      }

      return {
        text,
        usage: data.usageMetadata
          ? {
              inputTokens: data.usageMetadata.promptTokenCount,
              outputTokens: data.usageMetadata.candidatesTokenCount,
              totalTokens: data.usageMetadata.totalTokenCount,
            }
          : undefined,
        model,
        providerId: this.id,
        finishReason: mapGeminiFinishReason(data.candidates?.[0]?.finishReason),
      };
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw new AIError(
        AIErrorType.UNKNOWN_ERROR,
        `Gemini text generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  async generateStructured<T>(
    request: StructuredTextRequest,
  ): Promise<StructuredGeneration<T>> {
    const messages = [...request.messages];
    const lastUserIndex = findLastIndex(messages, (m) => m.role === 'user');
    if (lastUserIndex === -1) {
      throw new AIError(
        AIErrorType.UNKNOWN_ERROR,
        'generateStructured requires at least one user message',
      );
    }
    messages[lastUserIndex] = {
      role: 'user',
      content: new StructuredPromptBuilder(messages[lastUserIndex]?.content ?? '')
        .withSchema(request.schema)
        .build(),
    };

    const result = await this.generate({ ...request, messages, temperature: 0.1 });
    return { value: this.jsonParser.parse<T>(result.text), result };
  }

  async stream(request: TextRequest, callbacks: StreamCallbacks): Promise<GenerationResult> {
    // Gemini text streaming arrives as a single buffered payload on this
    // surface — emit it as one chunk so callers keep one code path.
    const result = await this.generate(request);
    callbacks.onChunk?.(result.text);
    callbacks.onComplete?.(result);
    return result;
  }

  async generateImage(request: ImageGenerationRequest): Promise<GeneratedContent> {
    try {
      const response = await this.withRetry(async () => {
        return await this.fetchWithTimeout(
          `${this.config.baseUrl}/models/${this.models.image}:generateContent`,
          {
            method: 'POST',
            headers: this.authHeaders(),
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: this.buildImagePrompt(request)
                }]
              }],
            }),
          }
        );
      });

      if (!response.ok) {
        const message = await extractErrorMessageFromResponse(response);
        throw new AIError(
          classifyHttpStatus(response.status),
          `Gemini image generation error (${response.status}): ${message}`,
          undefined,
          { status: response.status },
        );
      }

      const data: GeminiResponse = await response.json();

      const imageData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!imageData) {
        throw new AIError(AIErrorType.SERVER_ERROR, 'No image data in Gemini response');
      }

      const url = `data:${imageData.mimeType};base64,${imageData.data}`;

      return {
        id: Date.now().toString(),
        type: 'image',
        url,
        metadata: {
          provider: 'gemini',
          model: this.models.image,
          mimeType: imageData.mimeType,
        },
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Gemini image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateVideo(_request: VideoGenerationRequest): Promise<GeneratedContent> {
    throw new Error('Gemini provider does not support video generation');
  }

  async imageToVideo(_request: ImageToVideoRequest): Promise<GeneratedContent> {
    throw new Error('Gemini provider does not support image-to-video conversion');
  }

  async videoToVideo(_request: VideoToVideoRequest): Promise<GeneratedContent> {
    throw new Error('Gemini provider does not support video-to-video conversion');
  }

  private authHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-goog-api-key': this.config.apiKey,
    };
  }

  private buildImagePrompt(request: ImageGenerationRequest): string {
    let prompt = request.prompt;

    if (request.style) {
      const styles: Record<string, string> = {
        realistic: 'photorealistic, highly detailed, 8k resolution',
        cartoon: 'cartoon style, colorful, animated',
        abstract: 'abstract art, modern, artistic',
        minimalist: 'minimalist, clean, simple',
        vintage: 'vintage style, retro, classic',
      };
      prompt += `, ${styles[request.style]}`;
    }

    if (request.quality === 'ultra') {
      prompt += ', ultra high quality, masterpiece';
    }

    return prompt;
  }
}

/** Maps neutral messages to Gemini contents; assistant becomes 'model'. */
export function toGeminiContents(messages: ReadonlyArray<ChatMessage>): Array<{
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}> {
  return messages
    .filter((message) => message.role !== 'system' && message.content.length > 0)
    .map((message) => ({
      role: message.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: message.content }],
    }));
}

function mapGeminiFinishReason(reason: string | undefined) {
  if (reason === 'STOP') return 'stop' as const;
  if (reason === 'MAX_TOKENS') return 'length' as const;
  if (reason === 'SAFETY' || reason === 'PROHIBITED_CONTENT') return 'content_filter' as const;
  return undefined;
}

function findLastIndex<T>(items: ReadonlyArray<T>, predicate: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item !== undefined && predicate(item)) return i;
  }
  return -1;
}

export function createGeminiProvider(config: GeminiConfig): GeminiProvider {
  return new GeminiProvider(config);
}
