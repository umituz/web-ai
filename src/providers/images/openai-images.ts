import type { TokenUsage } from '../../core/types';
import type { OpenAiCompatibleConfig } from '../embeddings/openai-embeddings';

export interface ImageRequest {
  readonly externalModelId: string;
  readonly prompt: string;
  readonly size: string;
  readonly quality: string;
}

export interface ImageResult {
  readonly images: ReadonlyArray<string>;
  readonly usage: TokenUsage | null;
}

export interface ImageAdapter {
  generate(req: ImageRequest): Promise<ImageResult>;
}

interface WireImage {
  b64_json?: string;
}

interface WireUsage {
  input_tokens?: number;
  output_tokens?: number;
}

interface WireResponse {
  data?: WireImage[];
  error?: { message?: string };
  usage?: WireUsage;
}

export const IMAGE_SIZES = ['1024x1024', '1536x1024', '1024x1536'] as const;
export const IMAGE_QUALITIES = ['auto', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];
export type ImageQuality = (typeof IMAGE_QUALITIES)[number];

export const IMAGE_B64_LIMIT = 12_000_000;

export function createOpenAiImageAdapter(config: OpenAiCompatibleConfig): ImageAdapter {
  return {
    async generate(req: ImageRequest): Promise<ImageResult> {
      const response = await fetch(`${config.baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: req.externalModelId,
          prompt: req.prompt,
          n: 1,
          size: req.size,
          quality: req.quality,
        }),
        signal: AbortSignal.timeout(config.timeoutMs ?? 60_000),
      });

      if (!response.ok) {
        let detail: string | undefined;
        try {
          const body = (await response.json()) as WireResponse;
          detail = body.error?.message;
        } catch {
          detail = undefined;
        }
        throw new Error(detail ?? `Image provider failed with HTTP ${response.status}`);
      }

      let payload: WireResponse;
      try {
        payload = (await response.json()) as WireResponse;
      } catch {
        throw new Error('The image provider returned an unreadable response.');
      }

      const images = (payload.data ?? [])
        .map((item) => item.b64_json)
        .filter((value): value is string => typeof value === 'string' && value.length > 0);

      if (images.length === 0) {
        throw new Error('The image provider returned no image data.');
      }
      if (images.some((value) => value.length > IMAGE_B64_LIMIT)) {
        throw new Error('The generated image exceeds the storage limit.');
      }

      const usage = payload.usage;
      return {
        images,
        usage: usage
          ? {
              inputTokens: usage.input_tokens ?? 0,
              outputTokens: usage.output_tokens ?? 0,
              totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
            }
          : null,
      };
    },
  };
}
