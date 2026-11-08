
export const CANCELLATION_MESSAGE = 'Request cancelled by user';

export class CancellationError extends Error {
  constructor(message: string = CANCELLATION_MESSAGE) {
    super(message);
    this.name = 'CancellationError';
  }
}

export function isCancellationError(value: unknown): value is CancellationError {
  return value instanceof CancellationError;
}
