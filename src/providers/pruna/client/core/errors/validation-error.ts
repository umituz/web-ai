
export interface ValidationErrorContext {
  field: string;
  reason: string;
  receivedValue?: unknown;
}

export class ValidationError extends Error {
  readonly field: string;
  readonly reason: string;
  readonly receivedValue: unknown;

  constructor(context: ValidationErrorContext) {
    super(`Invalid ${context.field}: ${context.reason}`);
    this.name = 'ValidationError';
    this.field = context.field;
    this.reason = context.reason;
    this.receivedValue = context.receivedValue;
  }
}

export function isValidationError(value: unknown): value is ValidationError {
  return value instanceof ValidationError;
}
