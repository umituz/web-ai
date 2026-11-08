
import { PRUNA_BASE_URL, BASE64_MARKER } from '../constants';
import type { PrunaPredictionResponse } from '../entities/types';
import { isTerminalSuccessStatus } from '../protocol/job-status';
import { isHttpsUrl } from '../protocol/pruna-url-builder';

interface UrlOutput {
  url: string;
}

type PredictionOutput =
  | string
  | UrlOutput
  | readonly string[]
  | null
  | undefined;

const uriCache = new WeakMap<PrunaPredictionResponse, string | null>();

export function stripBase64Prefix(image: string): string {
  if (isHttpsUrl(image)) return image;
  const base64Index = image.indexOf(BASE64_MARKER);
  return base64Index !== -1 ? image.slice(base64Index + BASE64_MARKER.length) : image;
}

function readOutput(output: PredictionOutput): string | null {
  if (typeof output === 'string') return output;
  if (Array.isArray(output) && output.length > 0) return output[0] ?? null;
  if (output !== null && typeof output === 'object' && 'url' in output) {
    return output.url;
  }
  return null;
}

export function extractUri(data: PrunaPredictionResponse): string | null {
  const cached = uriCache.get(data);
  if (cached !== undefined) return cached;

  if (!isTerminalSuccessStatus(data.status)) {
    uriCache.set(data, null);
    return null;
  }

  const result =
    data.generation_url ??
    readOutput(data.output as PredictionOutput) ??
    data.video_url ??
    data.data ??
    null;

  uriCache.set(data, result);
  return result;
}

export function resolveUri(uri: string): string {
  return uri.startsWith('/') ? `${PRUNA_BASE_URL}${uri}` : uri;
}
