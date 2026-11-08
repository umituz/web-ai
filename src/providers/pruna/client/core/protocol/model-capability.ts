
import type { PrunaModelId, PrunaInput } from '../entities/types';

export const SUPPORTED_MODEL_IDS: readonly PrunaModelId[] = ['p-image', 'p-image-edit', 'p-video'] as const;

export function isSupportedModelId(model: unknown): model is PrunaModelId {
  return typeof model === 'string'
    && (SUPPORTED_MODEL_IDS as readonly string[]).includes(model);
}

export function modelRequiresImage(model: PrunaModelId): boolean {
  return model === 'p-image-edit' || model === 'p-video';
}

export function modelRequiresFileUpload(model: PrunaModelId): boolean {
  return model === 'p-video';
}

export function modelProducesAssetUrl(model: PrunaModelId): boolean {
  return SUPPORTED_MODEL_IDS.includes(model);
}

export function modelSupportsPolling(model: PrunaModelId): boolean {
  return SUPPORTED_MODEL_IDS.includes(model);
}

export function modelSupportsSeed(model: PrunaModelId): boolean {
  return model === 'p-image' || model === 'p-image-edit';
}

export function modelSupportsDuration(model: PrunaModelId): boolean {
  return model === 'p-video';
}

export function modelSupportsResolution(model: PrunaModelId): boolean {
  return model === 'p-video';
}

export function inputRequiresImage(input: PrunaInput): boolean {
  return modelRequiresImage(input.model);
}
