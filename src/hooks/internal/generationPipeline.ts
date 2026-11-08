
import type {
  GenerationResult,
  GenerationProgress,
  GenerationType,
  ImageQuality,
  VideoQuality,
} from '../../content/domain/types/GenerationTypes';
import { generateWithPruna } from '../../providers/pruna/pruna.provider';
import { generateId } from '../../content/domain/utils/IdGenerator';
import { calculateContentCreditCost } from '../../content/domain/calculations/ContentCreditCost';
import { resolveDefaultPrunaModel } from '../../content/domain/calculations/DefaultModelSelection';

export interface PipelineHooks {
  setStatus: (status: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled') => void;
  setProgress: (progress: GenerationProgress | null) => void;
  setResult: (result: GenerationResult | null) => void;
  setError: (error: Error | null) => void;
}

export interface PipelineOptions {
  apiKey: string;
  signal: AbortSignal;
  onProgress?: (progress: GenerationProgress) => void;
}

export interface GenerationInput {
  type: GenerationType;
  prompt: string;
  image?: string;
  duration?: number;
  aspectRatio?: string;
  quality?: ImageQuality | VideoQuality;
  style?: string;
}

export interface UploadFn {
  (file: File, userId: string): Promise<string>;
}

const isBase64DataUrl = (value: string): boolean => value.startsWith('data:');

async function dataUrlToUploadedUrl(dataUrl: string, uploadPhoto: UploadFn, userId: string): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const file = new File([blob], 'image.jpg', { type: blob.type });
  return uploadPhoto(file, userId);
}

async function resolveImageInput(
  image: string | undefined,
  uploadPhoto: UploadFn | undefined,
  userId: string | undefined,
): Promise<string | undefined> {
  if (!image) return undefined;
  if (isBase64DataUrl(image) && uploadPhoto && userId) {
    return dataUrlToUploadedUrl(image, uploadPhoto, userId);
  }
  return image;
}

function buildResult(
  input: GenerationInput,
  finalUrl: string,
  model: string,
): GenerationResult {
  return {
    id: generateId('gen'),
    type: input.type,
    url: finalUrl,
    thumbnailUrl: finalUrl,
    status: 'completed',
    metadata: {
      provider: 'pruna',
      model,
      prompt: input.prompt,
      duration: input.duration,
      quality: input.quality,
      aspectRatio: input.aspectRatio,
      style: input.style,
    },
    createdAt: new Date().toISOString(),
  };
}

export async function runGeneration(
  input: GenerationInput,
  hooks: PipelineHooks,
  options: PipelineOptions,
  deps: {
    uploadPhoto?: UploadFn;
    userId?: string;
    checkCredits?: (cost: number) => boolean;
    saveResult?: (result: Omit<GenerationResult, 'id' | 'createdAt'>) => Promise<void>;
    onSuccess?: (result: GenerationResult) => void;
    onError?: (error: Error) => void;
  },
): Promise<GenerationResult | null> {
  try {
    hooks.setStatus('processing');
    hooks.setError(null);

    const cost = calculateContentCreditCost(input.type, input.quality);
    if (deps.checkCredits && !deps.checkCredits(cost)) {
      throw new Error(`Insufficient credits. Required: ${cost}`);
    }

    const image = await resolveImageInput(input.image, deps.uploadPhoto, deps.userId);

    hooks.setProgress({ stage: 'processing', progress: 0, message: 'Starting generation...' });

    let finalUrl: string | undefined;
    for await (const chunk of generateWithPruna(
      { ...input, image },
      options.apiKey,
      options.signal,
      (stage) => {
        const publicStage = stage === 'predicting' ? 'processing' : stage;
        const progressEvent: GenerationProgress = { stage: publicStage, progress: 50, message: `Generating... (${stage})` };
        hooks.setProgress(progressEvent);
        options.onProgress?.(progressEvent);
      },
    )) {
      if (chunk.error) throw chunk.error;
      if (chunk.result) finalUrl = chunk.result.url;
    }

    if (!finalUrl) {
      throw new Error('Generation failed: No result received');
    }

    const result = buildResult(input, finalUrl, resolveDefaultPrunaModel(input.type));
    hooks.setResult(result);
    hooks.setStatus('completed');
    hooks.setProgress({ stage: 'processing', progress: 100, message: 'Complete!' });

    if (deps.saveResult) {
      await deps.saveResult(result);
    }
    deps.onSuccess?.(result);
    return result;
  } catch (err) {
    if (options.signal.aborted) {
      hooks.setStatus('cancelled');
      hooks.setProgress(null);
      return null;
    }
    const e = err instanceof Error ? err : new Error(String(err));
    hooks.setError(e);
    hooks.setStatus('failed');
    hooks.setProgress(null);
    deps.onError?.(e);
    return null;
  }
}
