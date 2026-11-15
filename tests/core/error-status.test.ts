import { describe, expect, it } from "vitest";
import { AI_ERROR_STATUS, AiError, aiErrorStatus } from "../../src/core/errors";
import type { AiErrorCode } from "../../src/core/errors";

const ALL_CODES: AiErrorCode[] = [
  "invalid_key",
  "missing_key",
  "rate_limited",
  "capacity",
  "timeout",
  "invalid_request",
  "model_unavailable",
  "upstream_error",
  "network",
  "cancelled",
];

describe("AI_ERROR_STATUS", () => {
  it("maps every AiErrorCode to an HTTP status", () => {
    for (const code of ALL_CODES) {
      expect(AI_ERROR_STATUS[code], `code ${code}`).toBeGreaterThanOrEqual(400);
      expect(AI_ERROR_STATUS[code], `code ${code}`).toBeLessThan(600);
    }
  });

  it("keeps known statuses stable", () => {
    expect(AI_ERROR_STATUS.rate_limited).toBe(429);
    expect(AI_ERROR_STATUS.timeout).toBe(504);
    expect(AI_ERROR_STATUS.invalid_request).toBe(400);
    expect(AI_ERROR_STATUS.cancelled).toBe(400);
    expect(AI_ERROR_STATUS.missing_key).toBe(503);
  });

  it("aiErrorStatus agrees with the map", () => {
    const err = new AiError("upstream_error");
    expect(aiErrorStatus(err.code)).toBe(AI_ERROR_STATUS.upstream_error);
  });
});
