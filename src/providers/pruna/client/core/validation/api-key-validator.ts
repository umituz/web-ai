
import { MAX_API_KEY_LENGTH, MIN_API_KEY_LENGTH } from '../constants/network';
import { ValidationError } from '../errors/validation-error';

export function assertValidApiKey(apiKey: unknown): asserts apiKey is string {
  if (typeof apiKey !== 'string') {
    throw new ValidationError({
      field: 'apiKey',
      reason: 'must be a string',
      receivedValue: typeof apiKey,
    });
  }
  if (apiKey.length < MIN_API_KEY_LENGTH) {
    throw new ValidationError({
      field: 'apiKey',
      reason: 'must not be empty',
      receivedValue: apiKey,
    });
  }
  if (apiKey.length > MAX_API_KEY_LENGTH) {
    throw new ValidationError({
      field: 'apiKey',
      reason: `exceeds maximum length of ${MAX_API_KEY_LENGTH}`,
      receivedValue: apiKey.length,
    });
  }
}
