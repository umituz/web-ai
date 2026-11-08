import { AIError, type AIErrorMetadata } from "./ai-error";
import { AIErrorType } from "./ai-error-types";

export type GroqErrorMetadata = AIErrorMetadata;
export { AIErrorType as GroqErrorType };

/**
 * Drop-in backwards-compatible GroqError extending core AIError.
 * Ensures `err instanceof GroqError` and `err instanceof AIError` both evaluate to true.
 */
export class GroqError extends AIError {
  constructor(
    type: AIErrorType,
    message: string,
    cause?: Error,
    metadata: GroqErrorMetadata = {},
  ) {
    super(type, message, cause, metadata);
    this.name = "GroqError";
  }
}
