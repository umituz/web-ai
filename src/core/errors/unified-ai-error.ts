export type AiErrorCode =
  | 'invalid_key'
  | 'missing_key'
  | 'rate_limited'
  | 'capacity'
  | 'timeout'
  | 'invalid_request'
  | 'model_unavailable'
  | 'upstream_error'
  | 'network'
  | 'cancelled';

export const STATUS_TO_CODE: Readonly<Record<number, AiErrorCode>> = {
  400: 'invalid_request',
  401: 'invalid_key',
  403: 'invalid_key',
  404: 'model_unavailable',
  413: 'invalid_request',
  422: 'invalid_request',
  429: 'rate_limited',
  500: 'upstream_error',
  502: 'upstream_error',
  503: 'capacity',
  504: 'timeout',
};

export const CODE_MESSAGES: Readonly<Record<AiErrorCode, string>> = {
  invalid_key: 'The provider rejected the configured API key.',
  missing_key: 'The provider is not configured with an API key.',
  rate_limited: 'The provider rate limit was reached. Try again shortly.',
  capacity: 'The provider is temporarily at capacity. Try again shortly.',
  timeout: 'The model took too long to respond.',
  invalid_request: 'The request was rejected by the provider.',
  model_unavailable: 'The requested model is not available.',
  upstream_error: 'The provider returned an unexpected error.',
  network: 'Could not reach the provider.',
  cancelled: 'Generation was cancelled.',
};

export class AiError extends Error {
  readonly code: AiErrorCode;

  constructor(code: AiErrorCode, message?: string) {
    super(message ?? CODE_MESSAGES[code]);
    this.name = 'AiError';
    this.code = code;
  }

  get userMessage(): string {
    return this.message;
  }
}

export function aiErrorMessage(code: AiErrorCode): string {
  return CODE_MESSAGES[code];
}

export interface ProviderErrorShape {
  readonly type?: string;
  readonly code?: string;
}

function isApiKeyRejection(provider: ProviderErrorShape): boolean {
  if (provider.code === 'invalid_api_key') return true;
  return provider.type === undefined;
}

export function errorFromStatus(
  status: number,
  detail?: string,
  provider?: ProviderErrorShape,
): AiError {
  let code = STATUS_TO_CODE[status] ?? 'upstream_error';
  if (status === 403 && provider && !isApiKeyRejection(provider)) {
    code = 'model_unavailable';
  }
  return new AiError(code, detail ? `${CODE_MESSAGES[code]} (${detail})` : undefined);
}

export function errorFromUnknown(err: unknown): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof Error) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return new AiError('timeout');
    }
    if (err.name === 'TypeError') {
      return new AiError('network');
    }
    return new AiError('upstream_error', err.message);
  }
  return new AiError('upstream_error');
}
