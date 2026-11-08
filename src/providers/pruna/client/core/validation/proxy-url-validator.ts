
import { HTTPS_PREFIX, HTTP_PREFIX } from '../constants/network';
import { ValidationError } from '../errors/validation-error';

export function assertValidProxyUrl(proxyUrl: unknown): asserts proxyUrl is string {
  if (typeof proxyUrl !== 'string') {
    throw new ValidationError({
      field: 'proxyUrl',
      reason: 'must be a string',
      receivedValue: typeof proxyUrl,
    });
  }
  if (proxyUrl.length === 0) {
    throw new ValidationError({
      field: 'proxyUrl',
      reason: 'must not be empty',
      receivedValue: proxyUrl,
    });
  }
  if (!proxyUrl.startsWith(HTTPS_PREFIX) && !proxyUrl.startsWith(HTTP_PREFIX) && !proxyUrl.startsWith('/')) {
    throw new ValidationError({
      field: 'proxyUrl',
      reason: 'must start with http://, https://, or be a relative path',
      receivedValue: proxyUrl,
    });
  }
  try {
    new URL(proxyUrl, 'http://localhost');
  } catch {
    throw new ValidationError({
      field: 'proxyUrl',
      reason: 'is not a valid URL',
      receivedValue: proxyUrl,
    });
  }
}
