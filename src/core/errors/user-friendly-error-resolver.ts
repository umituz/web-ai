
import { AIError } from "./ai-error";
import { AIErrorType, USER_FRIENDLY_ERROR_MESSAGES } from "./ai-error-types";

const KEYWORD_FALLBACK_RULES: ReadonlyArray<{ keywords: ReadonlyArray<string>; type: AIErrorType }> = [
  { keywords: ["api key", "unauthorized"], type: AIErrorType.INVALID_API_KEY },
  { keywords: ["rate limit"], type: AIErrorType.RATE_LIMIT_ERROR },
  { keywords: ["network", "fetch"], type: AIErrorType.NETWORK_ERROR },
  { keywords: ["abort"], type: AIErrorType.ABORT_ERROR },
];

export function resolveUserFriendlyErrorMessage(error: unknown): string {
  if (error instanceof AIError) {
    return USER_FRIENDLY_ERROR_MESSAGES[error.type];
  }

  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    for (const rule of KEYWORD_FALLBACK_RULES) {
      if (rule.keywords.some((kw) => lower.includes(kw))) {
        return USER_FRIENDLY_ERROR_MESSAGES[rule.type];
      }
    }
    if (error.message.length > 0) return error.message;
  }

  return USER_FRIENDLY_ERROR_MESSAGES[AIErrorType.UNKNOWN_ERROR];
}
