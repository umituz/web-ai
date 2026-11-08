
import type { PrunaResolution } from '../entities/types';
import { ValidationError } from '../errors/validation-error';

export const SUPPORTED_RESOLUTIONS: readonly PrunaResolution[] = ['720p', '1080p'] as const;

export function isSupportedResolution(value: unknown): value is PrunaResolution {
  return typeof value === 'string'
    && (SUPPORTED_RESOLUTIONS as readonly string[]).includes(value);
}

export function assertValidResolution(
  value: unknown,
  fieldName: string = 'resolution',
): asserts value is PrunaResolution {
  if (value === undefined || value === null) return;
  if (!isSupportedResolution(value)) {
    throw new ValidationError({
      field: fieldName,
      reason: `must be one of ${SUPPORTED_RESOLUTIONS.join(', ')}`,
      receivedValue: value,
    });
  }
}
