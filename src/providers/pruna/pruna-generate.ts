import type {
  PrunaInput,
  GenerationStage,
  PrunaModelId,
  PrunaAspectRatio,
  PrunaResolution,
} from './client';
import { generate, generateImageThenVideo } from './client';

export interface PrunaRequest {
  model?: string;
  image?: string;
  prompt?: string;
  quality?: string;
  duration?: number;
  aspectRatio?: string;
  aspect_ratio?: string;
  motion?: number | string;
  resolution?: string;
  seed?: number;
  [key: string]: unknown;
}

export interface PrunaProgressStage {
  stage: 'uploading' | 'processing' | 'polling' | 'predicting';
  result?: { url: string; model?: string };
  error?: Error;
}

export interface PrunaCore {
  generate?: typeof generate;
  generateImageThenVideo?: typeof generateImageThenVideo;
}

export async function* generateWithPruna(
  request: PrunaRequest,
  apiKey: string,
  signal?: AbortSignal,
  onProgress?: (stage: PrunaProgressStage['stage'], attempt?: number) => void,
): AsyncGenerator<PrunaProgressStage> {
  const stages: PrunaProgressStage[] = [];
  let notify: (() => void) | null = null;
  let done = false;

  const wake = (): void => {
    const fn = notify;
    if (fn) {
      notify = null;
      fn();
    }
  };

  const handleProgress = (stage: GenerationStage) => {
    stages.push({ stage });
    onProgress?.(stage);
    wake();
  };

  const promise = (async () => {
    try {
      const model =
        (request.model as PrunaModelId | undefined) ??
        (request.image ? 'p-image-edit' : 'p-image');

      if (model === 'p-video' && !request.image && request.prompt) {
        // Text to video pipeline
        const videoRes = await generateImageThenVideo(
          apiKey,
          {
            prompt: request.prompt,
            duration: request.duration ?? 5,
            aspect_ratio: (request.aspectRatio ?? request.aspect_ratio ?? '16:9') as PrunaAspectRatio,
          },
          { signal, onProgress: handleProgress },
        );
        stages.push({
          stage: 'polling',
          result: { url: videoRes.url, model: 'p-video' },
        });
        return;
      }

      const input = {
        model,
        prompt: (request.prompt as string) ?? '',
        aspect_ratio: (request.aspectRatio ?? request.aspect_ratio ?? '1:1') as PrunaAspectRatio,
        ...(request.image ? { image: request.image as string } : {}),
        ...(request.duration ? { duration: request.duration as number } : {}),
        ...(request.resolution ? { resolution: request.resolution as PrunaResolution } : {}),
        ...(request.seed !== undefined ? { seed: request.seed as number } : {}),
      } as PrunaInput;

      const res = await generate(apiKey, input, {
        signal,
        onProgress: handleProgress,
      });

      stages.push({
        stage: 'polling',
        result: { url: res.url, model: res.model },
      });
    } catch (err) {
      stages.push({
        stage: 'processing',
        error: err instanceof Error ? err : new Error(String(err)),
      });
    } finally {
      done = true;
      wake();
    }
  })();

  while (!done || stages.length > 0) {
    if (stages.length === 0 && !done) {
      await new Promise<void>((resolve) => {
        notify = resolve;
      });
      notify = null;
    }
    while (stages.length > 0) {
      const nextStage = stages.shift();
      if (!nextStage) continue;
      yield nextStage;
      if (nextStage.error) {
        throw nextStage.error;
      }
    }
  }

  await promise;
}
