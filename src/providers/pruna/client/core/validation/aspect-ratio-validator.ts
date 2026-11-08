
import type { PrunaAspectRatio } from '../entities/types';
import { ValidationError } from '../errors/validation-error';

export const SUPPORTED_ASPECT_RATIOS: readonly PrunaAspectRatio[] = [
  '16:9',
  '9:16',
  '1:1',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
] as const;

export function isSupportedAspectRatio(value: unknown): value is PrunaAspectRatio {
  return typeof value === 'string'
    && (SUPPORTED_ASPECT_RATIOS as readonly string[]).includes(value);
}

export function assertValidAspectRatio(
  value: unknown,
  fieldName: string = 'aspect_ratio',
): asserts value is PrunaAspectRatio {
  if (value === undefined || value === null) return;
  if (!isSupportedAspectRatio(value)) {
    throw new ValidationError({
      field: fieldName,
      reason: `must be one of ${SUPPORTED_ASPECT_RATIOS.join(', ')}`,
      receivedValue: value,
    });
  }
}
