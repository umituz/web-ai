
export interface PrunaRequest {
  model?: string;
  image?: string;
  [key: string]: unknown;
}

export interface PrunaProgressStage {
  stage: 'uploading' | 'processing' | 'polling' | 'predicting';
  result?: { url: string; model?: string };
  error?: Error;
}

export interface PrunaCore {
  generateWithPruna?: (
    request: PrunaRequest,
    apiKey: string,
    signal?: AbortSignal,
    onProgress?: (stage: PrunaProgressStage['stage'], attempt?: number) => void,
  ) => AsyncGenerator<PrunaProgressStage>;
  submitPrediction?: (
    modelId: string,
    request: PrunaRequest,
    apiKey: string,
    signal?: AbortSignal,
    onProgress?: (stage: PrunaProgressStage['stage'], attempt?: number) => void,
  ) => Promise<{ output?: { url?: string }; status_url?: string; generation_url?: string }>;
  pollForResult?: (
    pollUrl: string,
    apiKey: string,
    maxAttempts: number,
    intervalMs: number,
    signal?: AbortSignal,
    onProgress?: (stage: PrunaProgressStage['stage'], attempt?: number) => void,
  ) => Promise<string>;
}

let prunaCorePromise: Promise<PrunaCore> | null = null;

async function loadPrunaCore(): Promise<PrunaCore> {
  if (!prunaCorePromise) {
    const specifier = '@umituz/pruna-provider/core';
    prunaCorePromise = import(specifier) as Promise<PrunaCore>;
  }
  return prunaCorePromise;
}

export async function* generateWithPruna(
  request: PrunaRequest,
  apiKey: string,
  signal?: AbortSignal,
  onProgress?: (stage: PrunaProgressStage['stage'], attempt?: number) => void,
): AsyncGenerator<PrunaProgressStage> {
  const prunaCore = await loadPrunaCore();

  if (prunaCore.generateWithPruna) {
    yield* prunaCore.generateWithPruna(request, apiKey, signal, onProgress);
    return;
  }

  if (!prunaCore.submitPrediction || !prunaCore.pollForResult) {
    throw new Error('@umituz/pruna-provider/core does not export required functions');
  }

  const modelId = request.model || (request.image ? 'p-image-edit' : 'p-image');
  const prediction = await prunaCore.submitPrediction(modelId, request, apiKey, signal, onProgress);

  if (prediction.output && typeof prediction.output === 'object' && 'url' in prediction.output) {
    yield {
      stage: 'predicting',
      result: { url: prediction.output.url as string, model: modelId },
    };
    return;
  }

  const pollUrl = prediction.status_url || prediction.generation_url;
  if (!pollUrl) {
    throw new Error('Pruna prediction response missing polling URL');
  }

  const resultUrl = await prunaCore.pollForResult(pollUrl, apiKey, 60, 2000, signal, onProgress);
  yield { stage: 'polling', result: { url: resultUrl, model: modelId } };
}
