
import type {
  PrunaModelId,
  PrunaPredictionResponse,
  PrunaFileUploadResponse,
  GenerationStage,
} from '../entities/types';
import {
  PRUNA_FILES_URL,
  PRUNA_PREDICTIONS_URL,
  HTTP_PREFIX,
  POLL_DEFAULTS,
  MIME_FILE_EXTENSION,
} from '../constants';
import { base64ToBytes } from '../utils/base64';
import { detectImageMime } from '../utils/mime-detector';
import { parseApiError } from '../utils/api-error-parser';
import { CancellationError } from '../errors/cancellation-error';
import { AuthenticationError } from '../errors/authentication-error';
import { TimeoutError } from '../errors/timeout-error';
import { isAuthFailureStatus } from '../protocol/http-status';
import { isTerminalSuccessStatus, isTerminalFailureStatus } from '../protocol/job-status';
import { isAbortError } from '../protocol/abort-signal-classifier';
import {
  buildPrunaApiUrl,
  buildFileUrlById,
  isHttpsUrl,
  isAbsoluteHttpUrl,
} from '../protocol/pruna-url-builder';
import { calculateExponentialBackoff } from '../math/exponential-backoff';
import { extractUri, resolveUri, stripBase64Prefix } from '../utils/uri-resolver';

interface UploadInit {
  method: 'POST';
  headers: Record<string, string>;
  body: FormData;
}

function buildFileExtension(mime: string): string {
  return MIME_FILE_EXTENSION[mime] ?? 'bin';
}


export async function uploadImage(
  base64OrUrl: string,
  apiKey: string,
  onProgress?: (stage: GenerationStage) => void,
): Promise<string> {
  if (isHttpsUrl(base64OrUrl)) return base64OrUrl;
  if (base64OrUrl.startsWith(HTTP_PREFIX)) {
    throw new Error('Only HTTPS URLs are supported for security.');
  }

  onProgress?.('uploading');

  const raw = stripBase64Prefix(base64OrUrl);

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(raw);
  } catch {
    throw new Error('Invalid image format. Provide base64 or a valid HTTPS URL.');
  }

  const mime = detectImageMime(bytes);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([buffer], { type: mime });
  const formData = new FormData();
  formData.append('content', blob, `upload.${buildFileExtension(mime)}`);

  const res = await fetch(PRUNA_FILES_URL, {
    method: 'POST',
    headers: { apikey: apiKey },
    body: formData,
  } satisfies UploadInit as RequestInit);

  if (!res.ok) {
    throw await parseApiError(res, 'File upload error');
  }

  const data: PrunaFileUploadResponse = await res.json();
  return data.urls?.get ?? buildFileUrlById(data.id ?? '');
}


export async function submitPrediction(
  model: PrunaModelId,
  input: Record<string, unknown>,
  apiKey: string,
  signal?: AbortSignal,
  onProgress?: (stage: GenerationStage) => void,
): Promise<PrunaPredictionResponse> {
  onProgress?.('predicting');

  const res = await fetch(PRUNA_PREDICTIONS_URL, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      Model: model,
      'Try-Sync': 'true',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
    signal,
  });

  if (!res.ok) {
    throw await parseApiError(res, 'API error');
  }

  return res.json();
}


export class GenerationFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerationFailedError';
  }
}

interface PollAttemptResult {
  outcome: 'succeeded' | 'continue' | 'transient-failure';
  uri?: string;
}

async function attemptPoll(fullUrl: string, apiKey: string, signal: AbortSignal): Promise<PollAttemptResult> {
  let res: Response;
  try {
    res = await fetch(fullUrl, { headers: { apikey: apiKey }, signal });
  } catch (err) {
    if (isAbortError(err)) throw new CancellationError();
    return { outcome: 'transient-failure' };
  }

  if (!res.ok) {
    if (isAuthFailureStatus(res.status)) throw new AuthenticationError();
    return { outcome: 'transient-failure' };
  }

  let data: PrunaPredictionResponse;
  try {
    data = await res.json();
  } catch {
    return { outcome: 'transient-failure' };
  }

  if (isTerminalSuccessStatus(data.status)) {
    const uri = extractUri(data);
    if (uri) return { outcome: 'succeeded', uri: resolveUri(uri) };
    return { outcome: 'transient-failure' };
  }

  if (isTerminalFailureStatus(data.status)) {
    throw new GenerationFailedError(data.error ?? 'Generation failed during processing.');
  }

  return { outcome: 'continue' };
}

export async function pollForResult(
  pollUrl: string,
  apiKey: string,
  maxAttempts: number = POLL_DEFAULTS.maxAttempts,
  intervalMs: number = POLL_DEFAULTS.intervalMs,
  signal?: AbortSignal,
  onProgress?: (stage: GenerationStage, attempt: number) => void,
): Promise<string> {
  const fullUrl = isAbsoluteHttpUrl(pollUrl) ? pollUrl : buildPrunaApiUrl(pollUrl);
  const controller = new AbortController();
  const onExternalAbort = (): void => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    for (let i = 0; i < maxAttempts; i++) {
      if (signal?.aborted) throw new CancellationError();

      const delay = calculateExponentialBackoff({ attempt: i, baseIntervalMs: intervalMs });
      await new Promise<void>(resolve => setTimeout(resolve, delay));

      if (signal?.aborted) throw new CancellationError();

      onProgress?.('polling', i + 1);

      const result = await attemptPoll(fullUrl, apiKey, controller.signal);
      if (result.outcome === 'succeeded' && result.uri) {
        return result.uri;
      }
    }

    throw new TimeoutError();
  } finally {
    signal?.removeEventListener('abort', onExternalAbort);
    controller.abort();
  }
}
