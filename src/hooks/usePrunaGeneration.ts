
import type { PrunaInput, PrunaResult, GenerateOptions } from '../providers/pruna/client/core/entities/types';
import { generate } from '../providers/pruna/client/generation/services/generation.service';
import { useAsyncAction, type AsyncActionApi } from './use-async-action';

export interface UsePrunaGenerationOptions {
  onSuccess?: (result: PrunaResult) => void;
  onError?: (error: Error) => void;
  onProgress?: GenerateOptions['onProgress'];
}

export type UsePrunaGenerationReturn = AsyncActionApi<PrunaResult, PrunaInput>;

export function usePrunaGeneration(
  apiKey: string,
  options: UsePrunaGenerationOptions = {},
): UsePrunaGenerationReturn {
  return useAsyncAction<PrunaResult, PrunaInput>(
    (input, signal) => generate(apiKey, input, { signal, onProgress: options.onProgress }),
    options,
  );
}
