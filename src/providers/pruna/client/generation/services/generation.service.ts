
import type {
  PrunaInput,
  PrunaResult,
  TextToVideoInput,
  GenerateOptions,
} from '../../core/entities/types';
import { DEFAULT_ASPECT_RATIO, P_VIDEO_DEFAULTS, POLL_DEFAULTS } from '../../core/constants';
import { submitPrediction, pollForResult } from '../../core/services/pruna-client.service';
import { extractUri, resolveUri } from '../../core/utils/uri-resolver';
import { globalDeduplicator } from '../../core/utils/request-deduplicator';
import { assertValidApiKey } from '../../core/validation/api-key-validator';
import { assertValidAspectRatio } from '../../core/validation/aspect-ratio-validator';
import { assertValidDuration } from '../../core/validation/duration-validator';
import { assertValidResolution } from '../../core/validation/resolution-validator';
import { assertSecureImageSource } from '../../core/validation/image-source-validator';
import { assertValidPrompt } from '../../core/validation/prompt-validator';
import { assertValidSeed } from '../../core/validation/seed-validator';
import {
  isTextToImageInput,
  isImageToImageInput,
  isImageToVideoInput,
} from '../../core/protocol/input-type-guard';
import { isTerminalSuccessStatus } from '../../core/protocol/job-status';
import { deriveGenerationCacheKey } from '../../core/math/cache-key-derivation';
import { createDefaultBuilderRegistry } from '../builders/builder-factory';
import type { ModelInputBuilderRegistry } from '../builders/model-input-builder';

const builderRegistry: ModelInputBuilderRegistry = createDefaultBuilderRegistry();

function validateGenerateInput(input: PrunaInput): void {
  assertValidPrompt(input.prompt, `${input.model}.prompt`);
  assertValidAspectRatio(input.aspect_ratio, `${input.model}.aspect_ratio`);

  if (isTextToImageInput(input)) {
    assertValidSeed(input.seed, `${input.model}.seed`);
  } else if (isImageToImageInput(input)) {
    assertSecureImageSource(input.image, `${input.model}.image`);
    assertValidSeed(input.seed, `${input.model}.seed`);
  } else if (isImageToVideoInput(input)) {
    assertSecureImageSource(input.image, `${input.model}.image`);
    assertValidDuration(input.duration, `${input.model}.duration`);
    assertValidResolution(input.resolution, `${input.model}.resolution`);
  }
}

export async function generate(
  apiKey: string,
  input: PrunaInput,
  options: GenerateOptions & { useCache?: boolean } = {},
): Promise<PrunaResult> {
  assertValidApiKey(apiKey);
  validateGenerateInput(input);

  const { signal, onProgress, useCache = true } = options;

  if (useCache) {
    const cacheKey = deriveGenerationCacheKey(apiKey, input as unknown as Record<string, unknown>);
    return globalDeduplicator.execute(cacheKey, () =>
      generateInternal(apiKey, input, { signal, onProgress }),
    );
  }

  return generateInternal(apiKey, input, { signal, onProgress });
}

async function generateInternal(
  apiKey: string,
  input: PrunaInput,
  options: GenerateOptions,
): Promise<PrunaResult> {
  const { signal, onProgress } = options;
  const builder = builderRegistry.resolve(input.model);
  const modelInput = await builder.build(input, { apiKey, signal, onProgress });

  const response = await submitPrediction(input.model, modelInput, apiKey, signal, onProgress);

  const syncUri = extractUri(response);
  if (syncUri) {
    return { url: resolveUri(syncUri), model: input.model };
  }

  const pollUrl = response.get_url ?? response.status_url;
  if (!pollUrl) {
    throw new Error('Pruna API returned no result and no polling URL.');
  }

  const url = await pollForResult(
    pollUrl,
    apiKey,
    POLL_DEFAULTS.maxAttempts,
    POLL_DEFAULTS.intervalMs,
    signal,
    onProgress,
  );

  return { url, model: input.model };
}

export async function generateImageThenVideo(
  apiKey: string,
  input: TextToVideoInput,
  options: GenerateOptions = {},
): Promise<PrunaResult> {
  assertValidApiKey(apiKey);
  assertValidPrompt(input.prompt, 'text-to-video.prompt');
  assertValidAspectRatio(input.aspect_ratio, 'text-to-video.aspect_ratio');
  assertValidDuration(input.duration, 'text-to-video.duration');
  assertValidResolution(input.resolution, 'text-to-video.resolution');

  const { signal, onProgress } = options;
  const aspectRatio = input.aspect_ratio ?? DEFAULT_ASPECT_RATIO;

  onProgress?.('predicting', 1);
  const imageResult = await generate(
    apiKey,
    { model: 'p-image', prompt: input.prompt, aspect_ratio: aspectRatio },
    { signal },
  );

  onProgress?.('predicting', 2);
  return generate(
    apiKey,
    {
      model: 'p-video',
      prompt: input.prompt,
      image: imageResult.url,
      duration: input.duration ?? P_VIDEO_DEFAULTS.duration,
      resolution: input.resolution ?? P_VIDEO_DEFAULTS.resolution,
      aspect_ratio: aspectRatio,
      draft: input.draft ?? P_VIDEO_DEFAULTS.draft,
    },
    { signal, onProgress },
  );
}

export { isTerminalSuccessStatus };
