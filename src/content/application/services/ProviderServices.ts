
import type {
  ImageGenerationRequest,
  VideoGenerationRequest,
  ImageToVideoRequest,
  VideoToVideoRequest,
  GeneratedContent,
} from '../../domain/config/ProviderConfig';
import type { ProviderFactory } from '../../../providers/factory/provider.factory';
import { AIError } from '../../domain/errors/AIErrors';

const wrapProviderError = (operation: string, error: unknown): AIError => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return new AIError(`${operation} failed: ${message}`, 'PROVIDER_ERROR', error);
};

const ensureFactory = (factory: ProviderFactory, operation: string): void => {
  if (factory.getAllProviders().length === 0) {
    throw new AIError(
      `${operation} failed: No providers are registered. ` +
      'Provide a ProviderConfig with at least one enabled provider when constructing AIContentService.',
      'PROVIDER_UNAVAILABLE',
    );
  }
};

export class MediaGenerationService {
  constructor(private readonly providerFactory: ProviderFactory) {}

  generateImage(request: ImageGenerationRequest): Promise<GeneratedContent> {
    ensureFactory(this.providerFactory, 'Image generation');
    return this.providerFactory.generateImage(request).catch((err) => {
      throw wrapProviderError('Image generation', err);
    });
  }

  generateVideo(request: VideoGenerationRequest): Promise<GeneratedContent> {
    ensureFactory(this.providerFactory, 'Video generation');
    return this.providerFactory.generateVideo(request).catch((err) => {
      throw wrapProviderError('Video generation', err);
    });
  }

  convertImageToVideo(request: ImageToVideoRequest): Promise<GeneratedContent> {
    ensureFactory(this.providerFactory, 'Image-to-video conversion');
    return this.providerFactory.imageToVideo(request).catch((err) => {
      throw wrapProviderError('Image-to-video conversion', err);
    });
  }

  transformVideo(request: VideoToVideoRequest): Promise<GeneratedContent> {
    ensureFactory(this.providerFactory, 'Video-to-video transformation');
    return this.providerFactory.videoToVideo(request).catch((err) => {
      throw wrapProviderError('Video-to-video transformation', err);
    });
  }
}
