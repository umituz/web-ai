
export const HTTPS_PREFIX = 'https://';
export const HTTP_PREFIX = 'http://';
export const BASE64_MARKER = 'base64,';

export const PRUNA_BASE_URL = 'https://api.pruna.ai';

export const PRUNA_PREDICTIONS_URL = `${PRUNA_BASE_URL}/v1/predictions`;

export const PRUNA_FILES_URL = `${PRUNA_BASE_URL}/v1/files`;

export const AUTH_FAILURE_STATUSES: readonly number[] = [401, 403] as const;

export const MIN_API_KEY_LENGTH = 1;

export const MAX_API_KEY_LENGTH = 256;
