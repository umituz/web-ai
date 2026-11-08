
import { AIErrorType } from "./ai-error-types";

const DEFAULT_RETRYABLE_TYPES: ReadonlySet<AIErrorType> = new Set([
  AIErrorType.NETWORK_ERROR,
  AIErrorType.RATE_LIMIT_ERROR,
  AIErrorType.SERVER_ERROR,
]);

const DEFAULT_AUTH_TYPES: ReadonlySet<AIErrorType> = new Set([
  AIErrorType.INVALID_API_KEY,
]);

export interface ErrorClassificationRule {
  readonly retryable: ReadonlySet<AIErrorType>;
  readonly auth: ReadonlySet<AIErrorType>;
}

export const DEFAULT_ERROR_CLASSIFICATION_RULE: ErrorClassificationRule = {
  retryable: DEFAULT_RETRYABLE_TYPES,
  auth: DEFAULT_AUTH_TYPES,
};

export function isRetryableErrorType(
  type: AIErrorType,
  rule: ErrorClassificationRule = DEFAULT_ERROR_CLASSIFICATION_RULE,
): boolean {
  return rule.retryable.has(type);
}

export function isAuthErrorType(
  type: AIErrorType,
  rule: ErrorClassificationRule = DEFAULT_ERROR_CLASSIFICATION_RULE,
): boolean {
  return rule.auth.has(type);
}
