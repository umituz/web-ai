
import { AIErrorType } from "./ai-error-types";

export interface HttpStatusClassificationRule {
  readonly unauthorizedStatuses: ReadonlySet<number>;
  readonly rateLimitedStatus: number;
  readonly serverErrorThreshold: number;
  readonly clientErrorThreshold: number;
}

export const DEFAULT_HTTP_STATUS_RULE: HttpStatusClassificationRule = {
  unauthorizedStatuses: new Set([401, 403]),
  rateLimitedStatus: 429,
  serverErrorThreshold: 500,
  clientErrorThreshold: 400,
};

export function classifyHttpStatus(
  status: number,
  rule: HttpStatusClassificationRule = DEFAULT_HTTP_STATUS_RULE,
): AIErrorType {
  if (rule.unauthorizedStatuses.has(status)) return AIErrorType.INVALID_API_KEY;
  if (status === rule.rateLimitedStatus) return AIErrorType.RATE_LIMIT_ERROR;
  if (status >= rule.serverErrorThreshold) return AIErrorType.SERVER_ERROR;
  if (status >= rule.clientErrorThreshold) return AIErrorType.CLIENT_ERROR;
  return AIErrorType.UNKNOWN_ERROR;
}
