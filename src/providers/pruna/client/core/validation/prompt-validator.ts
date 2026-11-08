
import { ValidationError } from '../errors/validation-error';

export const MIN_PROMPT_LENGTH = 1;
export const MAX_PROMPT_LENGTH = 4000;

export function isValidPrompt(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= MIN_PROMPT_LENGTH
    && value.length <= MAX_PROMPT_LENGTH
    && value.trim().length > 0;
}

export function assertValidPrompt(
  value: unknown,
  fieldName: string = 'prompt',
): asserts value is string {
  if (typeof value !== 'string') {
    throw new ValidationError({
      field: fieldName,
      reason: 'must be a string',
      receivedValue: typeof value,
    });
  }
  if (value.trim().length < MIN_PROMPT_LENGTH) {
    throw new ValidationError({
      field: fieldName,
      reason: 'must not be empty or whitespace-only',
      receivedValue: value,
    });
  }
  if (value.length > MAX_PROMPT_LENGTH) {
    throw new ValidationError({
      field: fieldName,
      reason: `exceeds maximum length of ${MAX_PROMPT_LENGTH} characters`,
      receivedValue: value.length,
    });
  }
}
