
export enum AIErrorType {
  INVALID_API_KEY = "INVALID_API_KEY",
  MISSING_CONFIG = "MISSING_CONFIG",
  NETWORK_ERROR = "NETWORK_ERROR",
  ABORT_ERROR = "ABORT_ERROR",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  CLIENT_ERROR = "CLIENT_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export const USER_FRIENDLY_ERROR_MESSAGES: Readonly<Record<AIErrorType, string>> = {
  [AIErrorType.INVALID_API_KEY]: "Please check your API key and try again.",
  [AIErrorType.MISSING_CONFIG]: "The provider is not configured. Please create a provider with createAI first.",
  [AIErrorType.NETWORK_ERROR]: "Network error. Please check your connection and try again.",
  [AIErrorType.ABORT_ERROR]: "Request was cancelled.",
  [AIErrorType.RATE_LIMIT_ERROR]: "You've reached the rate limit. Please wait a moment and try again.",
  [AIErrorType.SERVER_ERROR]: "The AI service is temporarily unavailable. Please try again later.",
  [AIErrorType.CLIENT_ERROR]: "The request was invalid. Please check your input and try again.",
  [AIErrorType.UNKNOWN_ERROR]: "An unexpected error occurred. Please try again.",
};
