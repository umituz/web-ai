
import type {
  GeneratedContent,
  PrunaConfig,
  ImageGenerationRequest,
  VideoGenerationRequest,
  ImageToVideoRequest,
  VideoToVideoRequest,
} from '../../content/domain/config/ProviderConfig';
import type { ProviderHealth } from '../../core/types';
import type { CostEstimateRequest, IMediaProvider } from '../base/provider.types';
import { AIError, AIErrorType } from '../../core/errors';
export { generateWithPruna } from './pruna-generate';
export type {
  PrunaRequest,
  PrunaProgressStage,
  PrunaCore,
} from './pruna-generate';

/**
 * Placeholder seat for the Pruna fleet: registering it makes the provider
 * visible to health/fallback machinery, while actual generation goes through
 * the lazy-loaded `generateWithPruna` helper (peer optional dependency).
 */
export class PrunaProvider implements IMediaProvider {
  readonly id = 'pruna';
  readonly name = 'Pruna AI';
  readonly capabilities = ['image', 'video'] as const;

  constructor(readonly config: PrunaConfig) {}

  async healthCheck(): Promise<ProviderHealth> {
    return this.config.apiKey ? 'healthy' : 'unavailable';
  }

  async estimateCost(_request: CostEstimateRequest): Promise<number> {
    return 1;
  }

  async generateImage(_request: ImageGenerationRequest): Promise<GeneratedContent> {
    throw new AIError(AIErrorType.UNKNOWN_ERROR, 'Use generateWithPruna instead');
  }

  async generateVideo(_request: VideoGenerationRequest): Promise<GeneratedContent> {
    throw new AIError(AIErrorType.UNKNOWN_ERROR, 'Use generateWithPruna instead');
  }

  async imageToVideo(_request: ImageToVideoRequest): Promise<GeneratedContent> {
    throw new AIError(AIErrorType.UNKNOWN_ERROR, 'Use generateWithPruna instead');
  }

  async videoToVideo(_request: VideoToVideoRequest): Promise<GeneratedContent> {
    throw new AIError(AIErrorType.UNKNOWN_ERROR, 'Use generateWithPruna instead');
  }
}

export function createPrunaProvider(config: PrunaConfig): PrunaProvider {
  return new PrunaProvider(config);
}
