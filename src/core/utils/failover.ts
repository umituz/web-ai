export const TRANSIENT_ERROR_CODES: ReadonlySet<string> = new Set([
  'capacity',
  'rate_limited',
  'timeout',
  'network',
]);

export interface FailoverErrorLike {
  readonly code?: string;
  readonly type?: string;
  readonly status?: number;
}

export function isTransientError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const candidate = err as FailoverErrorLike;
  if (candidate.code && TRANSIENT_ERROR_CODES.has(candidate.code)) return true;
  if (candidate.type && TRANSIENT_ERROR_CODES.has(candidate.type)) return true;
  if (candidate.status === 429 || candidate.status === 503 || candidate.status === 504) return true;
  return false;
}

export function canFailover(err: unknown, streamedChars: number): boolean {
  if (!isTransientError(err)) return false;
  return streamedChars === 0;
}

export interface ModelWithProvider {
  readonly model: {
    readonly id: string;
    readonly capabilities?: { readonly streaming?: boolean };
  };
  readonly provider: {
    readonly id: string;
  };
}

export function failoverCandidate<T extends ModelWithProvider>(
  primary: T,
  fallback: T | null,
): T | null {
  if (!fallback) return null;
  if (fallback.provider.id === primary.provider.id) return null;
  if (fallback.model.capabilities?.streaming === false) return null;
  return fallback;
}
