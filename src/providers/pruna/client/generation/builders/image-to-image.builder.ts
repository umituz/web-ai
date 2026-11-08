
import { DEFAULT_ASPECT_RATIO } from '../../core/constants';
import type { ImageToImageInput } from '../../core/entities/types';
import { stripBase64Prefix } from '../../core/utils/uri-resolver';
import type {
  ModelInputBuilder,
  ModelInputBuildContext,
} from './model-input-builder';

export class ImageToImageInputBuilder implements ModelInputBuilder<ImageToImageInput> {
  readonly model = 'p-image-edit' as const;

  build(
    input: ImageToImageInput,
    _context: ModelInputBuildContext,
  ): Promise<Record<string, unknown>> {
    const payload: Record<string, unknown> = {
      images: [stripBase64Prefix(input.image)],
      prompt: input.prompt,
      aspect_ratio: input.aspect_ratio ?? DEFAULT_ASPECT_RATIO,
    };

    if (input.seed !== undefined) {
      payload.seed = input.seed;
    }

    return Promise.resolve(payload);
  }
}
