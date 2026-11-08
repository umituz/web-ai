
export interface ApiErrorPayload {
  message?: string;
}

export interface PrunaApiError extends Error {
  statusCode: number;
}

export async function parseApiError(
  response: Response,
  fallback: string,
): Promise<PrunaApiError> {
  const payload = await response
    .json()
    .catch(() => ({ message: response.statusText })) as ApiErrorPayload;

  const message = payload.message ?? `${fallback}: ${response.status}`;
  const error = new Error(message) as PrunaApiError;
  error.statusCode = response.status;
  return error;
}
