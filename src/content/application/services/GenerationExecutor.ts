
import { parseAIResponse } from '../../infrastructure/utils/jsonParser';
import type { ITextGenerator, TextGenerationOptions } from '../../domain/interfaces/ITextGenerator';
import type { GenerationResult, TextRequest } from '../../../core/types';
import { AIError } from '../../domain/errors/AIErrors';
import { ProviderFactory } from '../../../providers/factory/provider.factory';

/**
 * The single LLM seam for the content services. runJson/runText keep the
 * string facade the nine services were built against; runChat passes a full
 * TextRequest through to the factory and returns the usage-complete
 * GenerationResult.
 */
export class GenerationExecutor {
  constructor(private readonly generator: ITextGenerator | ProviderFactory) {}

  async runJson<T>(prompt: string, fallback: T, generationOptions: TextGenerationOptions = {}): Promise<T> {
    const response = await this.generator.generateText(prompt, generationOptions);
    return parseAIResponse<T>(response, fallback);
  }

  runText(prompt: string, options: TextGenerationOptions = {}): Promise<string> {
    return this.generator.generateText(prompt, options);
  }

  /** Usage-complete pass-through; requires a ProviderFactory engine. */
  runChat(request: TextRequest): Promise<GenerationResult> {
    if (!(this.generator instanceof ProviderFactory)) {
      throw new AIError(
        'runChat requires a ProviderFactory engine — construct AIContentService with a provider config, not a custom ITextGenerator',
        'PROVIDER_UNAVAILABLE',
      );
    }
    return this.generator.chat(request);
  }
}
