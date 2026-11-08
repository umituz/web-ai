
import { ValidationError } from '../errors/validation-error';

export const MIN_VIDEO_DURATION_SECONDS = 1;
export const MAX_VIDEO_DURATION_SECONDS = 30;

export function isValidDuration(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= MIN_VIDEO_DURATION_SECONDS
    && value <= MAX_VIDEO_DURATION_SECONDS
    && Number.isInteger(value);
}

export function assertValidDuration(
  value: unknown,
  fieldName: string = 'duration',
): asserts value is number {
  if (value === undefined || value === null) return;
  if (!isValidDuration(value)) {
    throw new ValidationError({
      field: fieldName,
      reason: `must be an integer between ${MIN_VIDEO_DURATION_SECONDS} and ${MAX_VIDEO_DURATION_SECONDS} seconds`,
      receivedValue: value,
    });
  }
}
