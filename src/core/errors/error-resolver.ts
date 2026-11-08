
import { resolveUserFriendlyErrorMessage } from "./user-friendly-error-resolver";
import { AIError } from "./ai-error";
import { AIErrorType, USER_FRIENDLY_ERROR_MESSAGES } from "./ai-error-types";
import type { AIErrorMetadata } from "./ai-error";

export const resolveUserFriendlyMessage = resolveUserFriendlyErrorMessage;

export interface LoggedError {
  readonly message: string;
  readonly type: string;
  readonly stack?: string;
  readonly metadata?: AIErrorMetadata;
}

export function formatErrorForLogging(error: unknown): LoggedError {
  if (error instanceof AIError) {
    return {
      message: error.message,
      type: error.type,
      stack: error.stack,
      metadata: error.metadata,
    };
  }
  if (error instanceof Error) {
    return { message: error.message, type: error.name, stack: error.stack };
  }
  return { message: String(error), type: typeof error };
}

export { AIErrorType, USER_FRIENDLY_ERROR_MESSAGES };
