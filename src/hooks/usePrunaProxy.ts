
import type { PrunaInput, PrunaResult, GenerationStage } from '../providers/pruna/client/core/entities/types';
import { useAsyncAction, type AsyncActionApi } from './use-async-action';

interface ApiErrorPayload {
  message?: string;
}

export interface UsePrunaProxyOptions {
  proxyUrl: string;
  onSuccess?: (result: PrunaResult) => void;
  onError?: (error: Error) => void;
  onProgress?: (stage: GenerationStage) => void;
}

export type UsePrunaProxyReturn = AsyncActionApi<PrunaResult, PrunaInput>;

interface PrunaProxyExecutorOptions {
  onProgress?: (stage: GenerationStage) => void;
}

function createProxyExecutor(proxyUrl: string, executorOptions: PrunaProxyExecutorOptions) {
  return async (input: PrunaInput, signal: AbortSignal): Promise<PrunaResult> => {
    executorOptions.onProgress?.('uploading');

    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    });

    if (!res.ok) {
      const payload = await res
        .json()
        .catch(() => ({ message: res.statusText })) as ApiErrorPayload;
      throw new Error(payload.message ?? `Proxy error: ${res.status}`);
    }

    return res.json() as Promise<PrunaResult>;
  };
}

export function usePrunaProxy(
  options: UsePrunaProxyOptions,
): UsePrunaProxyReturn {
  const { proxyUrl, onProgress, onSuccess, onError } = options;

  return useAsyncAction<PrunaResult, PrunaInput>(
    createProxyExecutor(proxyUrl, { onProgress }),
    { onSuccess, onError },
  );
}
