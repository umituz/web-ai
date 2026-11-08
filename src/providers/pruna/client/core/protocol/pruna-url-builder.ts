
import { PRUNA_BASE_URL, PRUNA_FILES_URL } from '../constants/network';
import { HTTPS_PREFIX, HTTP_PREFIX } from '../constants/network';

export function isAbsoluteHttpUrl(value: string): boolean {
  return value.startsWith(HTTPS_PREFIX) || value.startsWith(HTTP_PREFIX);
}

export function isHttpsUrl(value: string): boolean {
  return value.startsWith(HTTPS_PREFIX);
}

export function buildPrunaApiUrl(pathOrUrl: string): string {
  if (isAbsoluteHttpUrl(pathOrUrl)) return pathOrUrl;
  return `${PRUNA_BASE_URL}${pathOrUrl}`;
}

export function buildFileUrlById(fileId: string): string {
  return `${PRUNA_FILES_URL}/${fileId}`;
}
