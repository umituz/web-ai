import { describe, expect, it } from "vitest";
import {
  handleProviderError,
  classifyGroqError,
} from "../../src/core/utils/provider-errors";
import { GroqError } from "../../src/core/errors/groq-error";
import { AIErrorType } from "../../src/core/errors/ai-error-types";

describe("handleProviderError", () => {
  it("backs off exponentially on rate limits (429)", () => {
    const res1 = handleProviderError({ status: 429 }, 1);
    expect(res1.action).toBe("retry");
    expect(res1.backoffDelayMs).toBe(1000);

    const res2 = handleProviderError({ status: 429 }, 2);
    expect(res2.action).toBe("retry");
    expect(res2.backoffDelayMs).toBe(2000);

    const res3 = handleProviderError({ status: 429 }, 3);
    expect(res3.action).toBe("retry");
    expect(res3.backoffDelayMs).toBe(4000);

    const res4 = handleProviderError({ status: 429 }, 4);
    expect(res4.action).toBe("fallback");
    expect(res4.fallbackModelId).toBe("offline-fallback");
  });

  it("supports custom fallback model for 429", () => {
    const res = handleProviderError({ status: 429 }, 5, "custom-fallback");
    expect(res.action).toBe("fallback");
    expect(res.fallbackModelId).toBe("custom-fallback");
  });

  it("handles timeouts and 504 errors", () => {
    const retry1 = handleProviderError({ isTimeout: true }, 1);
    expect(retry1.action).toBe("retry");
    expect(retry1.backoffDelayMs).toBe(1500);

    const fallback = handleProviderError({ isTimeout: true }, 3);
    expect(fallback.action).toBe("fallback");
    expect(fallback.fallbackModelId).toBe("llama-3.3-70b");
  });

  it("handles 500, 502, 503 errors", () => {
    const retry1 = handleProviderError({ status: 503 }, 1);
    expect(retry1.action).toBe("retry");
    expect(retry1.backoffDelayMs).toBe(1000);

    const fallback = handleProviderError({ status: 503 }, 3);
    expect(fallback.action).toBe("fallback");
    expect(fallback.fallbackModelId).toBe("llama-3.3-70b");
  });

  it("aborts unrecoverable client errors", () => {
    const abort = handleProviderError({ status: 400, message: "Invalid payload" }, 1);
    expect(abort.action).toBe("abort");
    expect(abort.reason).toBe("Invalid payload");
  });
});

describe("classifyGroqError", () => {
  it("classifies rate limit errors", () => {
    const err = new GroqError(AIErrorType.RATE_LIMIT_ERROR, "rate limit");
    const result = classifyGroqError(err);
    expect(result.code).toBe("ai.rateLimit");
    expect(result.status).toBe(429);
    expect(result.isRateLimit).toBe(true);
    expect(result.isTimeout).toBe(false);
  });

  it("classifies abort/timeout errors", () => {
    const err = new GroqError(AIErrorType.ABORT_ERROR, "aborted");
    const result = classifyGroqError(err);
    expect(result.code).toBe("ai.error");
    expect(result.status).toBe(504);
    expect(result.isTimeout).toBe(true);
    expect(result.isRateLimit).toBe(false);
  });

  it("classifies generic errors as 502", () => {
    const result = classifyGroqError(new Error("generic"));
    expect(result.code).toBe("ai.error");
    expect(result.status).toBe(502);
    expect(result.isTimeout).toBe(false);
    expect(result.isRateLimit).toBe(false);
  });
});
