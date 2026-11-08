
import { BaseProvider } from '../base/base.provider';
import type { GeneratedContent } from '../../content/domain/config/ProviderConfig';
import type { ProviderHealth } from '../../core/types';
import type { CostEstimateRequest, IMediaProvider } from '../base/provider.types';
import { ProviderTimingConfig } from '../../content/domain/limits/ProviderTimingConfig';
import { ModelDefaults } from '../../content/domain/limits/ModelDefaults';
import { estimateFalGenerationCost, resolveFalImageSize, resolveFalInferenceSteps } from '../../content/domain/predicates';
import type {
  FalConfig,
  ImageGenerationRequest,
  VideoGenerationRequest,
  ImageToVideoRequest,
  VideoToVideoRequest,
} from '../../content/domain/config/ProviderConfig';

interface FalResult {
  images?: Array<{ url: string }>;
  video?: { url: string };
  error?: string;
}

/** Media-only provider: fal.ai for image and video generation. */
export class FalProvider extends BaseProvider implements IMediaProvider {
  readonly id = 'fal';
  readonly name = 'FAL';
  readonly capabilities = ['image', 'video'] as const;

  private models: { image: string; video: string; imageToVideo: string };

  constructor(config: FalConfig) {
    super({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://queue.fal.run',
      timeout: config.timeout || ProviderTimingConfig.FAL_TIMEOUT_MS,
      retryAttempts: config.retryAttempts || ProviderTimingConfig.FAL_RETRY_ATTEMPTS,
    });

    this.models = {
      image: ModelDefaults.FAL_IMAGE,
      video: ModelDefaults.FAL_VIDEO,
      imageToVideo: ModelDefaults.FAL_IMAGE_TO_VIDEO,
    };
    if (config.models) {
      this.models = { ...this.models, ...config.models };
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      if (!this.config.apiKey) {
        return 'unavailable';
      }

      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/fal-ai/flux/schnell/status`,
        {
          method: 'HEAD',
          headers: {
            'Authorization': `Key ${this.config.apiKey}`,
          },
        }
      );

      return response.ok ? 'healthy' : 'degraded';
    } catch {
      return 'unavailable';
    }
  }

  async estimateCost(request: CostEstimateRequest): Promise<number> {
    return estimateFalGenerationCost(
      request as Parameters<typeof estimateFalGenerationCost>[0],
    );
  }

  async generateImage(request: ImageGenerationRequest): Promise<GeneratedContent> {
    try {
      const response = await this.withRetry(async () => {
        return await this.fetchWithTimeout(
          `${this.config.baseUrl}/${this.models.image}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Key ${this.config.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: request.prompt,
              image_size: resolveFalImageSize(request.format),
              num_inference_steps: resolveFalInferenceSteps(request.quality),
              num_images: request.quantity || 1,
            }),
          }
        );
      });

      if (!response.ok) {
        throw new Error(`FAL API error: ${response.statusText}`);
      }

      const data: FalResult = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      return {
        id: Date.now().toString(),
        type: 'image',
        url: data.images?.[0]?.url,
        metadata: {
          provider: 'fal',
          model: this.models.image,
        },
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`FAL image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateVideo(request: VideoGenerationRequest): Promise<GeneratedContent> {
    try {
      const response = await this.withRetry(async () => {
        return await this.fetchWithTimeout(
          `${this.config.baseUrl}/${this.models.video}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Key ${this.config.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: request.prompt,
              aspect_ratio: request.aspectRatio || '16:9',
            }),
          }
        );
      });

      if (!response.ok) {
        throw new Error(`FAL API error: ${response.statusText}`);
      }

      const data: FalResult = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      return {
        id: Date.now().toString(),
        type: 'video',
        url: data.video?.url,
        metadata: {
          provider: 'fal',
          model: this.models.video,
        },
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`FAL video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async imageToVideo(request: ImageToVideoRequest): Promise<GeneratedContent> {
    try {
      const response = await this.withRetry(async () => {
        return await this.fetchWithTimeout(
          `${this.config.baseUrl}/${this.models.imageToVideo}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Key ${this.config.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image_url: request.imageUrl,
              motion: request.motion || 'medium',
              prompt: request.prompt,
            }),
          }
        );
      });

      if (!response.ok) {
        throw new Error(`FAL API error: ${response.statusText}`);
      }

      const data: FalResult = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      return {
        id: Date.now().toString(),
        type: 'video',
        url: data.video?.url,
        metadata: {
          provider: 'fal',
          model: this.models.imageToVideo,
        },
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`FAL image-to-video failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async videoToVideo(_request: VideoToVideoRequest): Promise<GeneratedContent> {
    throw new Error('FAL provider does not support video-to-video conversion');
  }
}

export function createFalProvider(config: FalConfig): FalProvider {
  return new FalProvider(config);
}
