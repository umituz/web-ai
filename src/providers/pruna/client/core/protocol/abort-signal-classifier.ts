
export function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.code === DOMException.ABORT_ERR) return true;
  if (err instanceof Error && err.name === 'AbortError') return true;
  return false;
}

export function isAbortSignal(signal: unknown): signal is AbortSignal {
  return signal instanceof AbortSignal;
}

export function isSignalAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}
