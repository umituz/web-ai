import { describe, expect, it } from "vitest";
import { checkUserQuotaAndThrottle } from "../../src/core/utils/quota-throttler";

describe("checkUserQuotaAndThrottle", () => {
  it("allows requests when within token and rpm limits", () => {
    const result = checkUserQuotaAndThrottle({
      tokensUsed: 5000,
      monthlyLimit: 100000,
      requestsThisMinute: 5,
      rpmLimit: 30,
    });
    expect(result.allowed).toBe(true);
    expect(result.remainingMonthlyTokens).toBe(95000);
    expect(result.reason).toBeUndefined();
  });

  it("throttles when rpm limit is reached", () => {
    const result = checkUserQuotaAndThrottle({
      tokensUsed: 5000,
      monthlyLimit: 100000,
      requestsThisMinute: 30,
      rpmLimit: 30,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("rpm_exceeded");
    expect(result.remainingMonthlyTokens).toBe(95000);
  });

  it("blocks when monthly token quota is depleted", () => {
    const result = checkUserQuotaAndThrottle({
      tokensUsed: 100000,
      monthlyLimit: 100000,
      requestsThisMinute: 2,
      rpmLimit: 30,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("token_depleted");
    expect(result.remainingMonthlyTokens).toBe(0);
  });
});
