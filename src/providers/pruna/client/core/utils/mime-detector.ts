
import { IMAGE_SIGNATURES, DEFAULT_IMAGE_MIME, MIME_PNG, MIME_JPEG, MIME_WEBP } from '../constants/mime-types';

const MIN_SIGNATURE_BYTES = 2;

function matchesSignature(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

export function detectImageMime(bytes: Uint8Array): string {
  if (bytes.length < MIN_SIGNATURE_BYTES) return DEFAULT_IMAGE_MIME;

  if (matchesSignature(bytes, IMAGE_SIGNATURES.PNG)) return MIME_PNG;
  if (matchesSignature(bytes, IMAGE_SIGNATURES.JPEG)) return MIME_JPEG;
  if (matchesSignature(bytes, IMAGE_SIGNATURES.WEBP_RIFF)) return MIME_WEBP;
  return DEFAULT_IMAGE_MIME;
}
