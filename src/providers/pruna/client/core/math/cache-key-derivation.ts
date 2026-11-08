
import { compositeHash, hashValue } from './comparison-hash';

export interface RequestSignature {
  method: string;
  url: string;
  body?: Record<string, unknown>;
}

export function deriveRequestDeduplicationKey(signature: RequestSignature): string {
  const bodyHash = signature.body ? hashValue(signature.body) : '';
  return `${signature.method}:${signature.url}:${bodyHash}`;
}

export function deriveGenerationCacheKey(apiKey: string, input: Record<string, unknown>): string {
  return `${apiKey}:${compositeHash(input)}`;
}
