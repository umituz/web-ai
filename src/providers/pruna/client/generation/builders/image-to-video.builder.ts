
import { DEFAULT_ASPECT_RATIO, P_VIDEO_DEFAULTS } from '../../core/constants';
import type { ImageToVideoInput } from '../../core/entities/types';
import { CancellationError } from '../../core/errors/cancellation-error';
import { uploadImage } from '../../core/services/pruna-client.service';
import type {
  ModelInputBuilder,
  ModelInputBuildContext,
} from './model-input-builder';

export class ImageToVideoInputBuilder implements ModelInputBuilder<ImageToVideoInput> {
  readonly model = 'p-video' as const;

  async build(
    input: ImageToVideoInput,
    context: ModelInputBuildContext,
  ): Promise<Record<string, unknown>> {
    if (context.signal?.aborted) {
      throw new CancellationError();
    }

    const fileUrl = await uploadImage(
      input.image,
      context.apiKey,
      context.onProgress,
    );

    return {
      image: fileUrl,
      prompt: input.prompt,
      duration: input.duration ?? P_VIDEO_DEFAULTS.duration,
      resolution: input.resolution ?? P_VIDEO_DEFAULTS.resolution,
      fps: P_VIDEO_DEFAULTS.fps,
      draft: input.draft ?? P_VIDEO_DEFAULTS.draft,
      aspect_ratio: input.aspect_ratio ?? DEFAULT_ASPECT_RATIO,
      prompt_upsampling: P_VIDEO_DEFAULTS.promptUpsampling,
    };
  }
}
