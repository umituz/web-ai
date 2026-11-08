
import { BASE64_MARKER, HTTP_PREFIX, HTTPS_PREFIX } from '../constants/network';
import { ValidationError } from '../errors/validation-error';

export type ImageSourceKind = 'https-url' | 'http-url' | 'base64' | 'unknown';

export function classifyImageSource(source: string): ImageSourceKind {
  if (source.startsWith(HTTPS_PREFIX)) return 'https-url';
  if (source.startsWith(HTTP_PREFIX)) return 'http-url';
  if (source.includes(BASE64_MARKER) || /^[A-Za-z0-9+/=]+$/.test(source)) return 'base64';
  return 'unknown';
}

export function assertSecureImageSource(image: unknown, fieldName: string = 'image'): asserts image is string {
  if (typeof image !== 'string') {
    throw new ValidationError({
      field: fieldName,
      reason: 'must be a string',
      receivedValue: typeof image,
    });
  }
  const kind = classifyImageSource(image);
  if (kind === 'http-url') {
    throw new ValidationError({
      field: fieldName,
      reason: 'HTTP URLs are not supported; use HTTPS or a base64 data URI',
      receivedValue: image,
    });
  }
  if (kind === 'unknown') {
    throw new ValidationError({
      field: fieldName,
      reason: 'must be an HTTPS URL or a base64 data URI',
      receivedValue: typeof image,
    });
  }
}
