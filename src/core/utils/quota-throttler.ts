export interface QuotaCheckInput {
  readonly tokensUsed: number;
  readonly monthlyLimit: number;
  readonly requestsThisMinute: number;
  readonly rpmLimit: number;
}

export interface QuotaCheckResult {
  readonly allowed: boolean;
  readonly reason?: 'token_depleted' | 'rpm_exceeded';
  readonly remainingMonthlyTokens: number;
}

export function checkUserQuotaAndThrottle(input: QuotaCheckInput): QuotaCheckResult {
  if (input.requestsThisMinute >= input.rpmLimit) {
    return {
      allowed: false,
      reason: 'rpm_exceeded',
      remainingMonthlyTokens: Math.max(0, input.monthlyLimit - input.tokensUsed),
    };
  }

  if (input.tokensUsed >= input.monthlyLimit) {
    return {
      allowed: false,
      reason: 'token_depleted',
      remainingMonthlyTokens: 0,
    };
  }

  return {
    allowed: true,
    remainingMonthlyTokens: Math.max(0, input.monthlyLimit - input.tokensUsed),
  };
}
