import { AIError } from "./ai-error";
import { AIErrorType } from "./ai-error-types";
import { AI_ERROR_STATUS } from "./error-status";
import { AiError, CODE_MESSAGES, type AiErrorCode } from "./unified-ai-error";

export interface AiFailure {
  readonly code: AiErrorCode;
  readonly status: number;
  readonly message: string;
}

const TYPE_TO_CODE: Readonly<Record<AIErrorType, AiErrorCode>> = {
  [AIErrorType.INVALID_API_KEY]: "invalid_key",
  [AIErrorType.MISSING_CONFIG]: "missing_key",
  [AIErrorType.NETWORK_ERROR]: "network",
  [AIErrorType.ABORT_ERROR]: "timeout",
  [AIErrorType.RATE_LIMIT_ERROR]: "rate_limited",
  [AIErrorType.SERVER_ERROR]: "upstream_error",
  [AIErrorType.CLIENT_ERROR]: "invalid_request",
  [AIErrorType.UNKNOWN_ERROR]: "upstream_error",
};

export function aiFailureOf(error: unknown): AiFailure {
  if (error instanceof AiError) {
    return { code: error.code, status: AI_ERROR_STATUS[error.code], message: error.userMessage };
  }
  if (error instanceof AIError) {
    const code = TYPE_TO_CODE[error.type];
    return { code, status: AI_ERROR_STATUS[code], message: CODE_MESSAGES[code] };
  }
  if (error instanceof Error && error.name === "AbortError") {
    return { code: "timeout", status: AI_ERROR_STATUS.timeout, message: CODE_MESSAGES.timeout };
  }
  return { code: "upstream_error", status: AI_ERROR_STATUS.upstream_error, message: CODE_MESSAGES.upstream_error };
}
