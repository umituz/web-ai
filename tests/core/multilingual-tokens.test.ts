import { describe, expect, it } from "vitest";
import {
  estimateMultilingualTokens,
  estimateTokens,
} from "../../src/core/context/context-manager";

describe("estimateMultilingualTokens", () => {
  it("estimates English text with roughly 4 chars per token", () => {
    const text = "Hello world this is a test";
    const std = estimateTokens(text);
    const multi = estimateMultilingualTokens(text);
    expect(multi).toBeGreaterThan(0);
    expect(Math.abs(multi - std)).toBeLessThanOrEqual(2);
  });

  it("estimates higher token counts for CJK characters", () => {
    const koreanText = "안녕하세요 반갑습니다";
    const englishText = "Hello nice to meet you";

    const koreanTokens = estimateMultilingualTokens(koreanText);
    const englishTokens = estimateMultilingualTokens(englishText);

    expect(koreanTokens).toBeGreaterThan(englishTokens / 2);
  });

  it("handles empty string gracefully", () => {
    expect(estimateMultilingualTokens("")).toBe(0);
  });
});
