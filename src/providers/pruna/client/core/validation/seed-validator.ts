
import { ValidationError } from '../errors/validation-error';

export const MIN_SEED = -2_147_483_648;
export const MAX_SEED = 2_147_483_647;

export function isValidSeed(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && Number.isInteger(value)
    && value >= MIN_SEED
    && value <= MAX_SEED;
}

export function assertValidSeed(
  value: unknown,
  fieldName: string = 'seed',
): asserts value is number {
  if (value === undefined || value === null) return;
  if (!isValidSeed(value)) {
    throw new ValidationError({
      field: fieldName,
      reason: `must be an integer in [${MIN_SEED}, ${MAX_SEED}]`,
      receivedValue: value,
    });
  }
}
