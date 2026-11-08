
import { DEFAULT_ASPECT_RATIO } from '../../core/constants';
import type { TextToImageInput } from '../../core/entities/types';
import type {
  ModelInputBuilder,
  ModelInputBuildContext,
} from './model-input-builder';

export class TextToImageInputBuilder implements ModelInputBuilder<TextToImageInput> {
  readonly model = 'p-image' as const;

  build(
    input: TextToImageInput,
    _context: ModelInputBuildContext,
  ): Promise<Record<string, unknown>> {
    const payload: Record<string, unknown> = {
      prompt: input.prompt,
      aspect_ratio: input.aspect_ratio ?? DEFAULT_ASPECT_RATIO,
    };

    if (input.seed !== undefined) {
      payload.seed = input.seed;
    }

    return Promise.resolve(payload);
  }
}
